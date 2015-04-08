Declaire.js [![npm version](https://badge.fury.io/js/declaire.svg)](http://badge.fury.io/js/declaire) [![Build Status](https://travis-ci.org/syntheticore/declaire.svg?branch=master)](https://travis-ci.org/syntheticore/declaire) [![Dependency Status](https://david-dm.org/syntheticore/declaire.svg)](https://david-dm.org/syntheticore/declaire)
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

  - [ ] Template imports
  - [ ] Link bundle in header using async attr
  - [ ] Statement alternatives
  - [ ] Update local storage IDs
  - [ ] Local queries
  - [ ] Selectively update data structures using deep merge
  - [ ] Access permissions
  - [ ] Remote blocks
