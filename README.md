# COVID-19 Data Generator

## Introduction

This repository serves to generate semi-realistic COVID testing data

## Flags

`-h` or `--help` to output help

`-g <amount>` or `--generate=<amount>` amount of events to generate

## Purpose 

This project was implemented to demonstrate streaming COVID data for use in my
[JConf presentation](https://jconf.dev/session/?id=2521) demo.

## Functionality

This script uses `faker` to generate realistic data, and a `NeDB` wrapper (to
support promises) to store application state. There are two event types, `NEW`
and `UPDATED`. Their is a 2:1 ratio for event types.

* A new event is effectively a pending state for the test result. The patient is
  symptomatic and took a test, but is awaiting the result.
* An updated event is the result of the pending state. This can be confirmed,
  negative, dead, or recovered. Confirmed events have potential to generate
  another updated event (recovered or dead).


## Logging

All log messages write to `stderr` as to allow piping to programs like `jq`,
`curl`, or `kafka-topics.sh` for examples.


## Improvements

* Add flag to set default log level
* Add flag to disable logging
* Ensure that database data directory location works cross-platform (it doesn't)
* Add tests
