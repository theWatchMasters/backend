#!/bin/sh
set -e
yarn prisma migrate deploy 
yarn prisma generate 
yarn start