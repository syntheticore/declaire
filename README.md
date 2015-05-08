Declaire.js [![npm version](https://badge.fury.io/js/declaire.svg)](http://badge.fury.io/js/declaire) [![Build Status](https://travis-ci.org/syntheticore/declaire.svg?branch=master)](https://travis-ci.org/syntheticore/declaire) [![Coverage Status](https://coveralls.io/repos/syntheticore/declaire/badge.svg)](https://coveralls.io/r/syntheticore/declaire) [![Dependency Status](https://david-dm.org/syntheticore/declaire.svg)](https://david-dm.org/syntheticore/declaire)
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
  - [ ] Asynchronous get for models
  - [ ] Statement alternatives
  - [ ] Update local storage IDs
  - [ ] Local queries
  - [ ] Selectively update data structures using deep merge
  - [ ] Extend Models
  - [ ] ViewModel.listenTo()
  - [x] History & Rollback
  - [ ] Access permissions
  - [ ] Remote blocks
