import {v4 as uuid} from 'uuid';
import {newMockRoomsStore} from './testUtils';
import processorFactory from '../../src/commandProcessor';
import {baseCommandSchema} from '../../src/commandHandlers/commandHandlers';

test('process a dummy command successfully: create room on the fly', () => {
  const processor = processorFactory(
    {
      setPropertyCommand: {
        canCreateRoom: true,
        skipUserIdRoomCheck: true,
        fn: (room, command) => room.applyEvent('propertySetEvent', command.payload),
        schema: {$ref: 'command'}
      }
    },
    baseCommandSchema,
    {
      propertySetEvent: (room, eventPayload) => ({
        ...room,
        test: 'data.from.evt.handler',
        test2: eventPayload.payloadProperty
      })
    },
    newMockRoomsStore() //  no room exists in store
  );

  const commandId = uuid();
  return processor(
    {
      roomId: 'custom-room-id',
      id: commandId,
      name: 'setPropertyCommand',
      payload: {
        payloadProperty: 'command-payload-property'
      }
    },
    'abc'
  ).then(({producedEvents, room}) => {
    expect(producedEvents).toMatchEvents(
      commandId,
      producedEvents[0].roomId, // id is generated by commandprocessor
      'propertySetEvent'
    );

    expect(room).toBeDefined();
    expect(room.id).toBe('custom-room-id');
    expect(room.pristine).toBe(true);
    expect(room.test).toEqual('data.from.evt.handler');
    expect(room.test2).toEqual('command-payload-property');
  });
});

test('process a dummy command successfully: room loading by id', () => {
  const roomId = 'some-room-id_' + uuid();
  const roomStore = newMockRoomsStore({
    id: roomId
  });
  const processor = processorFactory(
    {
      setPropertyCommand: {
        canCreateRoom: true,
        skipUserIdRoomCheck: true,
        fn: (room, command) => room.applyEvent('propertySetEvent', command.payload),
        schema: {$ref: 'command'}
      }
    },
    baseCommandSchema,
    {
      propertySetEvent: (room) => ({...room, test: 'data.from.evt.handler'})
    },
    roomStore
  );

  const commandId = uuid();
  return processor(
    {
      id: commandId,
      roomId: roomId,
      name: 'setPropertyCommand',
      payload: {
        username: 'john'
      }
    },
    uuid()
  ).then(({producedEvents, room}) => {
    expect(producedEvents).toMatchEvents(
      commandId,
      producedEvents[0].roomId, // id is generated by commandprocessor
      'propertySetEvent'
    );

    expect(room).toBeDefined();
    expect(room.test).toEqual('data.from.evt.handler');
  });
});

test('process a dummy command with No Handler ( and thus no schema )', () => {
  const processor = processorFactory(
    {
      // no command handlers
    },
    baseCommandSchema,
    {},
    newMockRoomsStore()
  );

  return expect(
    processor(
      {
        id: uuid(),
        roomId: 'my-test-room',
        name: 'justACommand',
        payload: {
          prop: 'value'
        }
      },
      uuid()
    )
  ).rejects.toThrow('Cannot validate command, no matching schema found for "justACommand"!');
});

test('process a dummy command where command handler produced unknown event', () => {
  const processor = processorFactory(
    {
      setPropertyCommand: {
        canCreateRoom: true,
        skipUserIdRoomCheck: true,
        fn: (room, command) => room.applyEvent('unknownEvent', command.payload),
        schema: {$ref: 'command'}
      }
    },
    baseCommandSchema,
    {
      propertySetEvent: (room) => ({...room, test: 'data.from.evt.handler'})
    },
    newMockRoomsStore()
  );

  return expect(
    processor(
      {
        id: uuid(),
        roomId: 'some-room-id',
        name: 'setPropertyCommand',
        payload: {
          property: 'value'
        }
      },
      uuid()
    )
  ).rejects.toThrow('Cannot apply unknown event unknownEvent');
});

test('process a dummy command where command precondition throws', () => {
  const processor = processorFactory(
    {
      setPropertyCommand: {
        canCreateRoom: true,
        skipUserIdRoomCheck: true,
        preCondition: () => {
          throw new Error('Uh-uh. nono!');
        },
        fn: (room, command) => room.applyEvent('propertySetEvent', command.payload),
        schema: {$ref: 'command'}
      }
    },
    baseCommandSchema,
    {
      propertySetEvent: (room) => ({...room, test: 'data.from.evt.handler'})
    },
    newMockRoomsStore()
  );

  return expect(
    processor(
      {
        id: uuid(),
        roomId: 'some-room-id',
        name: 'setPropertyCommand',
        payload: {
          property: 'value'
        }
      },
      uuid()
    )
  ).rejects.toThrow('Precondition Error during "setPropertyCommand": Uh-uh. nono!');
});

test('process a dummy command where user does not belong to room', () => {
  const processor = processorFactory(
    {
      setPropertyCommand: {
        canCreateRoom: true,
        // here "skipUserIdRoomCheck" flag is not set (same as in most handlers)
        schema: {$ref: 'command'},
        fn: (room, command) => room.applyEvent('propertySetEvent', command.payload)
      }
    },
    baseCommandSchema,
    {
      propertySetEvent: (room) => ({...room, test: 'data.from.evt.handler'})
    },
    newMockRoomsStore()
  );

  return expect(
    processor(
      {
        id: uuid(),
        roomId: 'some-room-id',
        name: 'setPropertyCommand',
        payload: {
          property: 'value'
        }
      },
      uuid()
    )
  ).rejects.toThrow(
    /Precondition Error during "setPropertyCommand": Given user .* does not belong to room some-room-id/g
  );
});

test('process a dummy command where command validation fails', () => {
  const processor = processorFactory({}, {}, newMockRoomsStore());

  return expect(
    processor(
      {
        id: uuid(),
        roomId: 'my-test-room',
        // no name -> cannot load appropriate schema
        payload: {}
      },
      'abc'
    )
  ).rejects.toThrow('Command validation Error during "undefined": Command must contain a name');
});

test('process a dummy command where command validation fails (schema)', () => {
  const processor = processorFactory(
    {
      setPropertyCommand: {
        canCreateRoom: true,
        skipUserIdRoomCheck: true,
        fn: (room, command) => room.applyEvent('propertySetEvent', command.payload),
        schema: {
          properties: {
            payload: {
              type: 'object'
            }
          },
          required: ['payload']
        }
      }
    },
    baseCommandSchema,
    {
      propertySetEvent: (room) => ({
        ...room,
        test: 'data.from.evt.handler'
      })
    },
    newMockRoomsStore() //  no room exists in store
  );

  return expect(
    processor(
      {
        id: uuid(),
        roomId: 'my-test-room',
        name: 'setPropertyCommand'
        // payload property is missing
      },
      uuid()
    )
  ).rejects.toThrow(
    'Command validation Error during "setPropertyCommand": Missing required property: payload'
  );
});

test('process a dummy command WITHOUT roomId: where room must exist', () => {
  const processor = processorFactory(
    {
      setPropertyCommand: {
        fn: () => {},
        schema: {}
      }
    },
    baseCommandSchema,
    {},
    newMockRoomsStore()
  );

  return expect(
    processor(
      {
        id: uuid(),
        roomId: 'some-room-id',
        name: 'setPropertyCommand',
        payload: {
          prop: 'value'
        }
      },
      uuid()
    )
  ).rejects.toThrow(
    // no roomId given in command. handler does not allow creation of new room
    'Command "setPropertyCommand" only wants to get handled for an existing room'
  );
});

test('process a dummy command WITH roomId: where room must exist', () => {
  const processor = processorFactory(
    {
      setPropertyCommand: {
        fn: () => {},
        schema: {}
      }
    },
    baseCommandSchema,
    {},
    newMockRoomsStore()
  );

  return expect(
    processor(
      {
        id: uuid(),
        roomId: 'rm_' + uuid(),
        name: 'setPropertyCommand',
        payload: {
          prop: 'value'
        }
      },
      uuid()
    )
  ).rejects.toThrow(
    //  roomId is given in command, room does not exist. handler does not allow on-the-fly creation
    'Command "setPropertyCommand" only wants to get handled for an existing room!'
  );
});

/**
 * Assures that we handle two "simultaneously" incoming commands correctly.
 */
test('concurrency handling', () => {
  const mockRoomsStore = newMockRoomsStore({
    id: 'concurrency-test-room',
    manipulationCount: 0
  });

  const processor = processorFactory(
    {
      setPropertyCommand: {
        skipUserIdRoomCheck: true,
        fn: (room, command) => room.applyEvent('propertySetEvent', command.payload),
        schema: {}
      }
    },
    baseCommandSchema,
    {
      propertySetEvent: (room, eventPayload) => ({
        ...room,
        property: eventPayload.property,
        manipulationCount: room.manipulationCount + 1
      })
    },
    mockRoomsStore
  );

  const eventPromiseOne = processor(
    {
      id: uuid(),
      roomId: 'concurrency-test-room',
      name: 'setPropertyCommand',
      payload: {
        property: 'value'
      }
    },
    '1'
  );
  const eventPromiseTwo = processor(
    {
      id: uuid(),
      roomId: 'concurrency-test-room',
      name: 'setPropertyCommand',
      payload: {
        property: 'value'
      }
    },
    '1'
  );

  return Promise.all([eventPromiseOne, eventPromiseTwo])
    .then(() => mockRoomsStore.getRoomById('concurrency-test-room'))
    .then((room) => expect(room.manipulationCount).toBe(2));
});

test('detect structural problems in commandHandlers: no schema', () => {
  expect(() =>
    processorFactory(
      {
        setPropertyCommand: {
          fn: (room, command) => room.applyEvent('propertySetEvent', command.payload)
          // no property "schema" defined
        }
      },
      baseCommandSchema,
      {},
      newMockRoomsStore()
    )
  ).toThrow(/Fatal error: CommandHandler "setPropertyCommand" does not define "schema"!/g);
});

test('detect structural problems in commandHandlers: schema is not an object, but a string', () => {
  expect(() =>
    processorFactory(
      {
        setPropertyCommand: {
          fn: (room, command) => room.applyEvent('propertySetEvent', command.payload),
          schema: 'not-an-object' // <<- property "schema" must be an object
        }
      },
      baseCommandSchema,
      {},
      newMockRoomsStore()
    )
  ).toThrow(/Fatal error: "schema" on commandHandler "setPropertyCommand" must be an object!/g);
});

test('detect structural problems in commandHandlers: schema is not an object, but a function', () => {
  expect(() =>
    processorFactory(
      {
        setPropertyCommand: {
          fn: (room, command) => room.applyEvent('propertySetEvent', command.payload),
          schema: () => true // <<- property "schema" must be an object
        }
      },
      baseCommandSchema,
      {},
      newMockRoomsStore()
    )
  ).toThrow(/Fatal error: "schema" on commandHandler "setPropertyCommand" must be an object!/g);
});

test('detect structural problems in commandHandlers: "fn" is not a function', () => {
  expect(() =>
    processorFactory(
      {
        setPropertyCommand: {
          fn: 'some-string', // <<- property "fn" must be a function  (the actual handler function)
          schema: {}
        }
      },
      baseCommandSchema,
      {},
      newMockRoomsStore()
    )
  ).toThrow(/Fatal error: "fn" on commandHandler "setPropertyCommand" must be a function!/g);
});
