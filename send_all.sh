#!/bin/sh

node index.js --path /photo/0 "Hello Metanet. This is my photo album."
sleep 5

node index.js --path /photo/0/0 "2018 photos."
sleep 5
node index.js --path /photo/0/1 "2019 photos."
sleep 5

node index.js --path /photo/0/0/0 --file ./italy_photo1.jpg
sleep 5
node index.js --path /photo/0/0/1 --file ./italy_photo2.jpg
sleep 5
node index.js --path /photo/0/1/0 --file ./dubrovnik_photo1.jpg
sleep 5
node index.js --path /photo/0/1/1 --file ./dubrovnik_photo2.jpg