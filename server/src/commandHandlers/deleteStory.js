import {throwIfStoryIdNotFoundInRoom} from './commonPreconditions';

/**
 * A user deletes a story.
 * A story must be first marked as "trashed", before it can be deleted.
 * Story will be completely removed from room.
 */

const schema = {
  allOf: [
    {
      $ref: 'command'
    },
    {
      properties: {
        payload: {
          type: 'object',
          properties: {
            storyId: {
              type: 'string',
              format: 'uuidv4'
            }
          },
          required: ['storyId'],
          additionalProperties: false
        }
      }
    }
  ]
};

const deleteStoryCommandHandler = {
  schema,
  preCondition: (room, command) => {
    throwIfStoryIdNotFoundInRoom(room, command.payload.storyId);

    const isTrashed = !!room.stories[command.payload.storyId].trashed;
    if (!isTrashed) {
      throw new Error(
        `Given story ${command.payload.storyId} in room ${room.id} is not marked as "trashed". cannot delete it!`
      );
    }
  },
  fn: (room, command) => {
    room.applyEvent('storyDeleted', command.payload);
  }
};

export default deleteStoryCommandHandler;
