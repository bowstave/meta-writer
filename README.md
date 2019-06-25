# MetaWriter

Simple command-line tool that let's you upload metanet nodes.

## Installation instructions
`npm install -g @bowstave/meta-writer`


## Developer instructions

1. Clone this repo: `git clone git@github.com:bowstave/meta-writer.git`
2. `cd meta-writer`
3. `npm install`
4. For all the examples below, replace `meta-writer` with `node index`

(There is also a send_all.sh script that sends the included photos to the blockchain.)

## Setup

In order to use this tool, you will need access to some BSV for funding your transactions.  We suggest creating a new, independent wallet, fund it will a small amount of BSV and use this for your Metanet nodes.

You will need to place the master private key (xprv) in a file:

`$HOME/.meta-writer/funding_key`

This is a json formatted file that should contain your xprv and the derivation path of the address you have funds in.

```
{
  "xprv": "xprv9s21Z...........",
  "derivationPath": "m/0/0"
}
```

This derivation path should work for a standard ElectrumSV wallet for the address at index 0.

## Usage

Nodes are created hierarchically using a name and a path.  Let's say we want to create a Metanet tree for a photo album called myalbum.  We would first create the root node:

`meta-writer --path /myalbum/0 "My first album"`

Then let's create a second level of the tree with a couple of chapters:

`meta-writer --path /myalbum/0/0 "Family Photos"`
`meta-writer --path /myalbum/0/1 "Wildlife"`

Finally, let's publish some family photos in to the Family Photos chapter:

`meta-writer --path /myalbum/0/0/0 --file ./mum.png --type "image/png"`
`meta-writer --path /myalbum/0/0/1 --file ./dad.jpg --type "image/jpeg"`

and some animal photos in to the Wildlife chapter:

`meta-writer --path /myalbum/0/1/0 --file ./deer.png --type "image/png"`

Please note that any valid mime-type is allowed.

All the transaction IDs that were created are stored in a file in `$HOME/.meta-writer/myalbum.dat`, something like:

```
{
  "xprv":  "xprv9s21Z...........",
  "0":     "45a72b01c0a31a17a1eb82b32e1faf0175079fa2269a23cd659f6ce67afee67a",
  "0/0":   "ec307b4977d82a3056800926158537a14eb0ecf100febf3d757fb494ff2e4ace",
  "0/1":   "a6e06deac9fe38660420a3c160c175baf8af4ca62d3fc5bf6d0f865bfa759154",
  "0/0/0": "7788ddefabe821879d32de19a405ad2f375a39b54a52232c6bbd27c865d56421",
  "0/0/1": "4a61857838b348541c613ec09d99e1ddd7481841e6045d14c9b59761e7218335",
  "0/1/0": "66d88f71bfb97b559920f35e9e81e7a04fb81916fcb604f204d097a35e3239ed",
  "0/1/1": "4458ca278fd66354174fd1105b7c9045acdf26ccb1682f697e29982d161fd217"
}
```

Please note that the xprv in this file is the master private key of your Metanet node and is NOT the same as the funding key.  The addresses derived from it will contain funds as nodes are created, and having access to this key allows you to add more nodes to this Metanet tree.  **Please keep this secure.**





