import { clone, createRevision, flatClone, getDefaultRevision, now } from "../plugins/utils/index.js";
import { stripAttachmentsDataFromDocument } from "../rx-storage-helper.js";
export function docStateToWriteDoc(databaseInstanceToken, hasAttachments, keepMeta, docState, previous) {
  var docData = Object.assign({}, docState, {
    _attachments: hasAttachments && docState._attachments ? docState._attachments : {},
    _meta: keepMeta ? docState._meta : {
      lwt: now()
    },
    _rev: getDefaultRevision()
  });
  docData._rev = createRevision(databaseInstanceToken, previous);
  return docData;
}
export function writeDocToDocState(writeDoc, keepAttachments, keepMeta) {
  var ret = flatClone(writeDoc);
  if (!keepAttachments) {
    delete ret._attachments;
  }
  if (!keepMeta) {
    delete ret._meta;
  }
  delete ret._rev;
  return ret;
}
export function stripAttachmentsDataFromMetaWriteRows(state, rows) {
  if (!state.hasAttachments) {
    return rows;
  }
  return rows.map(row => {
    var document = clone(row.document);
    document.docData = stripAttachmentsDataFromDocument(document.docData);
    return {
      document,
      previous: row.previous
    };
  });
}
//# sourceMappingURL=helper.js.map