# backoff-decorator
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **This library is no longer maintained by Unito, please consider forking it if you intend to use it.**

This modules allows retrying an asynchronous call, backing off exponentially.
Optionally, full jitter can be added to the backoff time, as explained in this
[AWS article](https://www.awsarchitectureblog.com/2015/03/backoff.html). The
functionality is accessible directly through a function call, or using ES2016
decorators.


## Installation

```
npm install --save backoff-decorator
```

## Basic usage

```javascript
const Backoff = require("../src/backoff");
const request = require("request-promise");

// an error class used to determine when to retry
class NotNowError extends Error {}

// this function simulates an async call that fails
// 9 times than succeeds on the 10th call.
let trials = 0;
function get(url) {
  trials++;
  console.log(new Date());
  if (trials % 10 === 0) {
    console.log('fetching', url);
    return request.get(url);
  }
  else {
    return Promise.reject(new NotNowError());
  }
}

// this are the options to the backoff call
const backoffOptions = {
  maxRetries: 10,     // do not retry more than this amount of times
  maxDelayMs: 1000,   // cap the exponential backoff to this value
  backoffFactor: 100, // the backoff factor
  predicate: (err) => err instanceof NotNowError, // determines when to retry
  fullJitter: false,  // do not add random jitter
};


// call the 'get' function with retries.
// the arguments following the function itself are the same as bind()
Backoff.retry(backoffOptions, get, this, 'http://unito.io');
```

### Using a decorator

This example uses TypeScript to allow the use of decorators.

```js
import { backoff } from '../src/backoff';
import * as request from 'request-promise';

class NotNowError extends Error {}

class UnsureCaller {
  private trials = 0;

  async get(url: string): Promise<any> {
    this.trials++;
    console.log(new Date());
    if (this.trials % 10 === 0) {
      console.log('fetching', url);
      return request.get(url);
    } else {
      throw new NotNowError();
    }
  }
}

class Fetcher {
  backoffOptions = {
    maxRetries: 10,
    maxDelayMs: 1000,
    backoffFactor: 100,
    predicate: (err: Error) => err instanceof NotNowError,
    fullJitter: false,
  };

  private caller = new UnsureCaller();

  @backoff
  async fetchUrl(url: string): Promise<any> {
    return this.caller.get(url);
  }
}

const fetcher = new Fetcher();
fetcher.fetchUrl('http://unito.io');
```


## License

MIT
