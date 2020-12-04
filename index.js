#!/usr/bin/env node

// imports
const os = require("os");
const path = require("path")
const fs = require("fs");
const osenv = require("osenv");
const DataStore = require("nedb-promises");
const xdgBasedir = require("xdg-basedir");
const faker = require("faker");
const commandLineArgs = require("command-line-args");
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, align } = format;

// parse options first in case we have to exit early
const optionDefinitions = 
  [
    { name: "generate", alias: "g", type: Number },
    { name: "help", alias: "h", type: Boolean },
    { name: "clear", alias: "c", type: Boolean }
  ];
const options = commandLineArgs(optionDefinitions);

if (options.help) {
  console.error(
`-h --help       show help
-g --generate   amount of case events to generate
-c --clear      clear persistant store`
// -l --log-level  level to log [info, debug, error, verbose]
  );
  return;
}


const logger = createLogger({
  level: "debug",
  format: combine(
    colorize(),
    timestamp(),
    align(),
    printf(({ level, message, label, timestamp }) =>
      `${timestamp} ${level}: ${message}`)),
  transports: [
    new transports.Console({
      level: 'debug',
      stderrLevels: ["debug", "error", "info", "warn", "verbose"]
    })
  ]
});

// constants
const NEW_EVENT = "NEW",
  UPDATE_EVENT = "UPDATE",
  NEW_STATUS = "POTENTIAL",
  CONFIRMED_STATUS = "CONFIRMED",
  NEGATIVE_STATUS = "NEGATIVE",
  DEAD_STATUS = "DEAD",
  RECOVERED_STATUS = "RECOVERED",
  EVENT_TYPES = [NEW_EVENT, UPDATE_EVENT]
  UPDATE_STATUSES = [CONFIRMED_STATUS, NEGATIVE_STATUS],
  UPDATE_CONFIRMED_STATUSES = [DEAD_STATUS, RECOVERED_STATUS],
  EARLIEST_DOB = new Date(1970, 01),
  LATEST_DOB = new Date(2020, 01),
  DB_FILE= "data-gen.nedb";

const db = createDataStore();

( async () => {
  if(options.clear) {
    logger.verbose("Clearing all documents in persistent store");

    await db.remove({},{multi: true}, (err, removed) => {
      logger.debug(`Removed ${removed} document(s)`);
    });
    return;
  }
  logger.verbose(`Generating ${options.generate || 0} case events`);
  for (let i = 0; i < options.generate; i++) {
    const eventType = faker.random.arrayElement(EVENT_TYPES);
    logger.verbose(`Processing ${eventType} event`);
    let event;

    // we can catch any errors and continue processing
    switch(eventType) {
      case NEW_EVENT:
        try {
          event = await handleNewEvent();
        } catch {}
        break;
      case UPDATE_EVENT:
        try {
          event = await handleUpdateEvent();
        } catch {}
        break;
    }
    if(event) {
    console.log(JSON.stringify(event));
    }
  }
})();


// Generate a new event and push to data store
async function handleNewEvent() {
  logger.verbose("Generating new event");
  const dateOfBirth = faker.date.between(EARLIEST_DOB, LATEST_DOB);
  let caseEvent = {
    id: faker.random.number({ min: 1 }),
    testDate: faker.date.recent(30),
    dateOfBirth: dateOfBirth,
    name: faker.name.findName(),
    location: `${faker.address.city()}, ${faker.address.stateAbbr()}`,
    age: Math.floor((Date.now() - dateOfBirth) / (1000 * 3600 * 24 * 365.25)),
    status: NEW_STATUS,
    type: NEW_EVENT,
  };

  try {
    caseEvent = await db.insert(caseEvent);
  } catch(err) {
    logger.error(err);
    throw err;
  }
  logger.debug(`Document inserted (id: ${caseEvent.id})`);

  return caseEvent;
}

// Update an existing an event and pop from data store
async function handleUpdateEvent() {
  logger.verbose("Updating existing event");
  let caseEvent;
  try {
    logger.verbose("Grabbing earliest event from datastore by testDate");
    caseEvent = await db.findOne({}).sort({ testDate: -1}).exec();
  } catch(err) {
    logger.error(err);
    throw err;
  }
  if(!caseEvent) {
    logger.warn("No document exists to update - skipping");
    throw "No existing document";
  }

  let caseEventStatus;
  let finalState = false;

  // could only be new or confirmed - but lets else if to guarantee
  if(caseEvent.status == NEW_STATUS) {
    caseEventStatus = faker.random.arrayElement(UPDATE_STATUSES);
    finalState = caseEventStatus == NEGATIVE_STATUS;
  } else if(caseEvent.status == CONFIRMED_STATUS) {
    caseEventStatus = faker.random.arrayElement(UPDATE_CONFIRMED_STATUSES);
    finalState = true;
  }

  caseEvent.type = UPDATE_EVENT;
  caseEvent.status = caseEventStatus;

  if(finalState) {
    let numRemoved;
    try {
      numRemoved = await db.remove({ _id: caseEvent._id }, {});
    } catch(err) {
      logger.error(err);
      throw err;
    }
    logger.debug(`Document removed (id: ${caseEvent.id})`)
  } else {
    let numReplaced;
    try {
      numReplaced = await db.update({ _id: caseEvent._id}, { $set: { status: caseEventStatus, type: UPDATE_EVENT }});
    } catch(err) {
      logger.error(err);
      throw err;
    }
    logger.debug(`Document updated (id: ${caseEvent.id})`);
  }

  delete caseEvent._id;
  return caseEvent;
}

function getDataDirectory() {
  var user = (osenv.user() || uuid.v4()).replace(/\\/g, "");
  return path.join(xdgBasedir.data, "covid-datagenerator") ||
    path.join(os.tmpdir(), user, "covid-datagenerator");
}

function createDataStore() {
  const dataDir = getDataDirectory();
  logger.debug(`Database location ${dataDir}`);

  if (!fs.existsSync(dataDir)) {
    logger.debug("Directory doesn't exist - creating now");
    fs.mkdirSync(dataDir);
  }
  return DataStore.create({ filename: path.join(dataDir, DB_FILE), autoload: true });
}
