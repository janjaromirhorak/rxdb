import { getComposedPrimaryKeyOfDocumentData } from "../rx-schema-helper.js";
import { stackCheckpoints } from "../rx-storage-helper.js";
import { createRevision, ensureNotFalsy, getDefaultRevision, getDefaultRxDocumentMeta, now } from "../plugins/utils/index.js";
export async function getLastCheckpointDoc(state, direction) {
  var checkpointDocId = getComposedPrimaryKeyOfDocumentData(state.input.metaInstance.schema, {
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
export async function setCheckpoint(state, direction, checkpoint) {
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
      _meta: getDefaultRxDocumentMeta(),
      _rev: getDefaultRevision()
    };
    newDoc.id = getComposedPrimaryKeyOfDocumentData(state.input.metaInstance.schema, newDoc);
    while (!state.events.canceled.getValue()) {
      /**
       * Instead of just storing the new checkpoint,
       * we have to stack up the checkpoint with the previous one.
       * This is required for plugins like the sharding RxStorage
       * where the changeStream events only contain a Partial of the
       * checkpoint.
       */
      if (previousCheckpointDoc) {
        newDoc.checkpointData = stackCheckpoints([previousCheckpointDoc.checkpointData, newDoc.checkpointData]);
      }
      newDoc._meta.lwt = now();
      newDoc._rev = createRevision(await state.checkpointKey, previousCheckpointDoc);
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
          previousCheckpointDoc = ensureNotFalsy(error.documentInDb);
          newDoc._rev = createRevision(await state.checkpointKey, previousCheckpointDoc);
        }
      }
    }
  }
}
export async function getCheckpointKey(input) {
  var hash = await input.hashFunction([input.identifier, input.forkInstance.databaseName, input.forkInstance.collectionName].join('||'));
  return 'rx_storage_replication_' + hash;
}
//# sourceMappingURL=checkpoint.js.map