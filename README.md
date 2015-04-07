Declaire.js
=========

Declarative, full-stack web application framework

## Installation

  npm install declaire --save

## Usage

  require('declaire')({
    mongoDevUrl: 'mongodb://127.0.0.1:27017/myapp'
  }, function(declaire, start) {
    start();
  });

## Tests

  npm test

## License

  MIT
