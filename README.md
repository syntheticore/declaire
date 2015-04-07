Declaire.js [![Build Status](https://travis-ci.org/syntheticore/declaire.svg?branch=master)](https://travis-ci.org/syntheticore/declaire)
=========

Declarative, full-stack web application framework

## Installation

    npm install declaire --save

## Usage

  ```JavaScript
  require('declaire')({
    mongoDevUrl: 'mongodb://127.0.0.1:27017/myapp'
  }, function(declaire, start) {
    start();
  });
  ```

## License

  MIT

## Todo

  - [x] Template imports
  - [x] Link bundle in header using async attr
  - [x] Statement alternatives
  - [x] Update local storage IDs
  - [x] Local queries
  - [x] Selectively update data structures using deep merge
  - [x] Access permissions
  - [x] Remote blocks
