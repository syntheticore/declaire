# Declaire.js
[![npm version](https://badge.fury.io/js/declaire.svg)](http://badge.fury.io/js/declaire) [![Build Status](https://travis-ci.org/syntheticore/declaire.svg?branch=master)](https://travis-ci.org/syntheticore/declaire) [![Coverage Status](https://coveralls.io/repos/syntheticore/declaire/badge.svg)](https://coveralls.io/r/syntheticore/declaire) [![Dependency Status](https://david-dm.org/syntheticore/declaire.svg)](https://david-dm.org/syntheticore/declaire)

Declarative, full-stack web application framework

## Installation

    npm install declaire --save

## Usage

  ```JavaScript
  var declaire = require('declaire');

  var app = declaire.Application({
    mongoDevUrl: 'mongodb://127.0.0.1:27017/my-app'
  });

  app.init(function(start) {
    start();
  });
  ```

## License

  MIT

