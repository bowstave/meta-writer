#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const bsv = require('bsv')
const explorer = require('bitcore-explorers')
const request = require('request-promise')

const fee = 400
const feeb = 1.1
const minimumOutputValue = 546

async function sendTX (hex) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    uri: 'https://api.whatsonchain.com/v1/bsv/main/tx/raw',
    body: {
      txhex: hex
    },
    json: true
  }

  try {
    const response = await request(options)
    return response
  } catch (err) {
    throw err
  }
}

function getData (name) {
  return getDataWithExtension(`${name}.dat`)
}

function getFundingKey () {
  const data = getDataWithExtension('funding_key')
  if (data.xprv) {
    if (!data.derivationPath) {
      throw new Error('You must have a derivationPath defined for this master private key.')
    }
    return new bsv.HDPrivateKey(data.xprv).deriveChild(data.derivationPath)
  } else if (data.priv) {
    return new bsv.PrivateKey(data.priv)
  }
  return null
}

function getDataWithExtension (name) {
  const homeDir = process.env.HOME

  const filename = path.join(homeDir, '.meta-writer', name)

  let data
  try {
    data = JSON.parse(fs.readFileSync(filename))
  } catch (e) {
    const dir = path.join(homeDir, '.meta-writer')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
    }

    data = { xprv: bsv.HDPrivateKey().xprivkey }
    fs.writeFileSync(filename, JSON.stringify(data, null, 2))
  }

  if (!data.xprv) {
    throw new Error('Invalid private key.')
  }

  return data
}

function dumpData (name, data) {
  const homeDir = process.env.HOME

  const filename = path.join(homeDir, '.meta-writer', `${name}.dat`)

  fs.writeFileSync(filename, JSON.stringify(data, null, 2))
}

function filterUTXOs (utxos, satoshisRequired) {
  let total = 0
  const res = utxos.filter((utxo, i) => {
    if (total < satoshisRequired) {
      total += utxo.satoshis
      return true
    }
    return false
  })

  if (total < satoshisRequired) {
    throw new Error(`Insufficient funds (need ${satoshisRequired} satoshis, have ${total})`)
  }

  return res
}

async function getUtxosFromBitIndex (address) {
  return new Promise((resolve, reject) => {
    const insight = new explorer.Insight('https://api.bitindex.network')
    insight.getUnspentUtxos(address, (err, res) => {
      if (err) {
        reject(err)
      } else {
        resolve(res)
      }
    })
  })
}

function getDummyUTXO () {
  return bsv.Transaction.UnspentOutput({
    address: '19dCWu1pvak7cgw5b1nFQn9LapFSQLqahC',
    txId: 'e29bc8d6c7298e524756ac116bd3fb5355eec1da94666253c3f40810a4000804',
    outputIndex: 0,
    satoshis: 5000000000,
    scriptPubKey: '21034b2edef6108e596efb2955f796aa807451546025025833e555b6f9b433a4a146ac'
  })
}

async function addNode (fundingKey, parentKey, childKey, script) {
  // First, estimate the fee for the metanet node transaction
  const tempTX = new bsv.Transaction().from([getDummyUTXO()])

  tempTX.addOutput(new bsv.Transaction.Output({ script, satoshis: 0 }))

  if (parentKey === null) {
    tempTX.fee(fee).change(fundingKey.publicKey.toAddress())
  }

  const feeForMetanetNode = Math.max(Math.ceil(tempTX._estimateSize() * feeb), minimumOutputValue)

  // Now we have decide how to fund it.
  let utxos = await getUtxosFromBitIndex(fundingKey.publicKey.toAddress())

  if (parentKey) {
    // We are adding a child metanet node: we need to send funds to
    utxos = filterUTXOs(utxos, feeForMetanetNode + fee)

    let tx = new bsv.Transaction()
      .from(utxos)
      .to(parentKey.publicKey.toAddress(), feeForMetanetNode)
      .fee(fee)
      .change(fundingKey.publicKey.toAddress())

    const thisFee = Math.ceil(tx._estimateSize() * feeb)
    tx.fee(thisFee)

    tx.sign(fundingKey.privateKey)

    const result = await sendTX(tx.toString())

    utxos = [bsv.Transaction.UnspentOutput({
      address: parentKey.publicKey.toAddress().toString(),
      txId: result,
      outputIndex: 0,
      satoshis: tx.outputs[0].satoshis,
      scriptPubKey: tx.outputs[0].script.toHex()
    })]
  } else {
    utxos = filterUTXOs(utxos, feeForMetanetNode)
  }

  // Create metanet node
  // First, estimate the fee for the metanet node transaction
  let metaTX = new bsv.Transaction().from(utxos)

  metaTX.addOutput(new bsv.Transaction.Output({ script, satoshis: 0 }))

  if (parentKey === null) {
    metaTX.fee(feeForMetanetNode)
    metaTX.change(fundingKey.publicKey.toAddress())
    metaTX.sign(fundingKey.privateKey)
  } else {
    metaTX.sign(parentKey.privateKey)
  }

  const result = await sendTX(metaTX.toString())
  // console.log(result, 'metaTX:', metaTX.toString())

  return result
}

;(async () => {
  const optionDefinitions = [
    { name: 'file', alias: 'f', type: String },
    { name: 'path', alias: 'p', type: String },
    { name: 'type', alias: 't', type: String },
    { name: 'src', type: String, defaultOption: true }
  ]

  const commandLineArgs = require('command-line-args')
  const options = commandLineArgs(optionDefinitions)

  if (!options.path) {
    console.log('You must specify a path for the metanet node')
    process.exit(1)
  }

  if (!options.file && !options.src) {
    console.log('You must specify a file or some text for the metanet node')
    process.exit(1)
  }

  if (options.file && !options.type) {
    console.log('You must specify a mime type for this file, for example, --type "image/jpeg"')
    process.exit(1)
  }

  const p = options.path

  const parts = p.split('/')
  parts.shift() // Skip the first element of the path

  const name = parts.shift()
  const data = getData(name)
  let parentKey = null
  let parentPath = null

  const masterPrivateKey = bsv.HDPrivateKey(data.xprv)
  if (parts.length === 1) {
    if (parts[0] !== '0') {
      throw new Error('Only one root not is allowed.')
    }
  } else {
    parentPath = parts.slice(0, -1).join('/')
    parentKey = masterPrivateKey.deriveChild('m/' + parentPath)
  }

  const childPath = parts.join('/')
  const childKey = masterPrivateKey.deriveChild('m/' + childPath)

  const fundingKey = getFundingKey()

  const oprParts = []
  oprParts.push('OP_RETURN')
  oprParts.push(Buffer.from('meta').toString('hex'))
  oprParts.push(Buffer.from(childKey.publicKey.toAddress().toString()).toString('hex'))
  const txid = (parentKey === null ? 'NULL' : data[parentPath])
  oprParts.push(Buffer.from(txid).toString('hex'))

  if (options.file) {
    oprParts.push(Buffer.from('19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut').toString('hex'))
    oprParts.push(fs.readFileSync(options.file).toString('hex'))
    oprParts.push(Buffer.from(options.type).toString('hex'))
    oprParts.push(Buffer.from('binary').toString('hex'))
    oprParts.push(Buffer.from(path.basename(options.file)).toString('hex'))
  } else {
    oprParts.push(Buffer.from(options.src).toString('hex'))
  }

  const script = bsv.Script.fromASM(oprParts.join(' '))

  if (script.toBuffer().length > 100000) {
    console.log(`Maximum OP_RETURN size is 100000 bytes. Script is ${script.toBuffer().length} bytes.`)
    process.exit(1)
  }

  const tx = await addNode(fundingKey, parentKey, childKey, script.toString())

  data[childPath] = tx.toString()
  dumpData(name, data)

  console.log(tx.toString())
})()
