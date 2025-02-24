"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getCheckpointKey = getCheckpointKey;
exports.getLastCheckpointDoc = getLastCheckpointDoc;
exports.setCheckpoint = setCheckpoint;
var _rxSchemaHelper = require("../rx-schema-helper.js");
var _rxStorageHelper = require("../rx-storage-helper.js");
var _index = require("../plugins/utils/index.js");
async function getLastCheckpointDoc(state, direction) {
  var checkpointDocId = (0, _rxSchemaHelper.getComposedPrimaryKeyOfDocumentData)(state.input.metaInstance.schema, {
    isCheckpoint: '1',
    itemId: direction
  });
  var checkpointResult = await state.input.metaInstance.findDocumentsById([checkpointDocId], false);
  var checkpointDoc = checkpointResult[0];
  state.lastCheckpointDoc[direction] = checkpointDoc;
  if (checkpointDoc) {
    return checkpointDoc.checkpointData;
  } else {
    return undefined;
  }
}

/**
 * Sets the checkpoint,
 * automatically resolves conflicts that appear.
 */
async function setCheckpoint(state, direction, checkpoint) {
  var previousCheckpointDoc = state.lastCheckpointDoc[direction];
  if (checkpoint &&
  /**
   * If the replication is already canceled,
   * we do not write a checkpoint
   * because that could mean we write a checkpoint
   * for data that has been fetched from the master
   * but not been written to the child.
   */
  !state.events.canceled.getValue() && (
  /**
   * Only write checkpoint if it is different from before
   * to have less writes to the storage.
   */

  !previousCheckpointDoc || JSON.stringify(previousCheckpointDoc.checkpointData) !== JSON.stringify(checkpoint))) {
    var newDoc = {
      id: '',
      isCheckpoint: '1',
      itemId: direction,
      _deleted: false,
      _attachments: {},
      checkpointData: checkpoint,
      _meta: (0, _index.getDefaultRxDocumentMeta)(),
      _rev: (0, _index.getDefaultRevision)()
    };
    newDoc.id = (0, _rxSchemaHelper.getComposedPrimaryKeyOfDocumentData)(state.input.metaInstance.schema, newDoc);
    while (!state.events.canceled.getValue()) {
      /**
       * Instead of just storing the new checkpoint,
       * we have to stack up the checkpoint with the previous one.
       * This is required for plugins like the sharding RxStorage
       * where the changeStream events only contain a Partial of the
       * checkpoint.
       */
      if (previousCheckpointDoc) {
        newDoc.checkpointData = (0, _rxStorageHelper.stackCheckpoints)([previousCheckpointDoc.checkpointData, newDoc.checkpointData]);
      }
      newDoc._meta.lwt = (0, _index.now)();
      newDoc._rev = (0, _index.createRevision)(await state.checkpointKey, previousCheckpointDoc);
      var result = await state.input.metaInstance.bulkWrite([{
        previous: previousCheckpointDoc,
        document: newDoc
      }], 'replication-set-checkpoint');
      var sucessDoc = result.success[0];
      if (sucessDoc) {
        state.lastCheckpointDoc[direction] = sucessDoc;
        return;
      } else {
        var error = result.error[0];
        if (error.status !== 409) {
          throw error;
        } else {
          previousCheckpointDoc = (0, _index.ensureNotFalsy)(error.documentInDb);
          newDoc._rev = (0, _index.createRevision)(await state.checkpointKey, previousCheckpointDoc);
        }
      }
    }
  }
}
async function getCheckpointKey(input) {
  var hash = await input.hashFunction([input.identifier, input.forkInstance.databaseName, input.forkInstance.collectionName].join('||'));
  return 'rx_storage_replication_' + hash;
}
//# sourceMappingURL=checkpoint.js.map