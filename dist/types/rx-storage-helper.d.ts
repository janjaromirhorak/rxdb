/**
 * Helper functions for accessing the RxStorage instances.
 */
import type { BulkWriteRow, BulkWriteRowProcessed, CategorizeBulkWriteRowsOutput, RxAttachmentData, RxAttachmentWriteData, RxChangeEvent, RxCollection, RxDatabase, RxDocumentData, RxDocumentWriteData, RxJsonSchema, RxStorageWriteError, RxStorageChangeEvent, RxStorageInstance, RxStorageInstanceCreationParams, StringKeys } from './types/index.d.ts';
import { Observable } from 'rxjs';
export declare const INTERNAL_STORAGE_NAME = "_rxdb_internal";
export declare const RX_DATABASE_LOCAL_DOCS_STORAGE_NAME = "rxdatabase_storage_local";
export declare function getSingleDocument<RxDocType>(storageInstance: RxStorageInstance<RxDocType, any, any>, documentId: string): Promise<RxDocumentData<RxDocType> | undefined>;
/**
 * Writes a single document,
 * throws RxStorageBulkWriteError on failure
 */
export declare function writeSingle<RxDocType>(instance: RxStorageInstance<RxDocType, any, any>, writeRow: BulkWriteRow<RxDocType>, context: string): Promise<RxDocumentData<RxDocType>>;
/**
 * Observe the plain document data of a single document.
 * Do not forget to unsubscribe.
 */
export declare function observeSingle<RxDocType>(storageInstance: RxStorageInstance<RxDocType, any, any>, documentId: string): Observable<RxDocumentData<RxDocType>>;
/**
 * Checkpoints must be stackable over another.
 * This is required form some RxStorage implementations
 * like the sharding plugin, where a checkpoint only represents
 * the document state from some, but not all shards.
 */
export declare function stackCheckpoints<CheckpointType>(checkpoints: CheckpointType[]): CheckpointType;
export declare function storageChangeEventToRxChangeEvent<DocType>(isLocal: boolean, rxStorageChangeEvent: RxStorageChangeEvent<DocType>, rxCollection?: RxCollection): RxChangeEvent<DocType>;
export declare function throwIfIsStorageWriteError<RxDocType>(collection: RxCollection<RxDocType, any, any>, documentId: string, writeData: RxDocumentWriteData<RxDocType> | RxDocType, error: RxStorageWriteError<RxDocType> | undefined): void;
/**
 * Analyzes a list of BulkWriteRows and determines
 * which documents must be inserted, updated or deleted
 * and which events must be emitted and which documents cause a conflict
 * and must not be written.
 * Used as helper inside of some RxStorage implementations.
 * @hotPath The performance of this function is critical
 */
export declare function categorizeBulkWriteRows<RxDocType>(storageInstance: RxStorageInstance<any, any, any>, primaryPath: StringKeys<RxDocType>, 
/**
 * Current state of the documents
 * inside of the storage. Used to determine
 * which writes cause conflicts.
 * This must be a Map for better performance.
 */
docsInDb: Map<RxDocumentData<RxDocType>[StringKeys<RxDocType>] | string, RxDocumentData<RxDocType>>, 
/**
 * The write rows that are passed to
 * RxStorageInstance().bulkWrite().
 */
bulkWriteRows: BulkWriteRow<RxDocType>[], context: string): CategorizeBulkWriteRowsOutput<RxDocType>;
export declare function stripAttachmentsDataFromRow<RxDocType>(writeRow: BulkWriteRow<RxDocType>): BulkWriteRowProcessed<RxDocType>;
export declare function getAttachmentSize(attachmentBase64String: string): number;
/**
 * Used in custom RxStorage implementations.
 */
export declare function attachmentWriteDataToNormalData(writeData: RxAttachmentData | RxAttachmentWriteData): RxAttachmentData;
export declare function stripAttachmentsDataFromDocument<RxDocType>(doc: RxDocumentWriteData<RxDocType>): RxDocumentData<RxDocType>;
/**
 * Flat clone the document data
 * and also the _meta field.
 * Used many times when we want to change the meta
 * during replication etc.
 */
export declare function flatCloneDocWithMeta<RxDocType>(doc: RxDocumentData<RxDocType>): RxDocumentData<RxDocType>;
/**
 * Each event is labeled with the id
 * to make it easy to filter out duplicates
 * even on flattened eventBulks
 */
export declare function getUniqueDeterministicEventKey(eventBulkId: string, rowId: number, docId: string, writeRowDocument: RxDocumentWriteData<any>): string;
export type WrappedRxStorageInstance<RxDocumentType, Internals, InstanceCreationOptions> = RxStorageInstance<RxDocumentType, any, InstanceCreationOptions> & {
    originalStorageInstance: RxStorageInstance<RxDocumentType, Internals, InstanceCreationOptions>;
};
/**
 * Wraps the normal storageInstance of a RxCollection
 * to ensure that all access is properly using the hooks
 * and other data transformations and also ensure that database.lockedRun()
 * is used properly.
 */
export declare function getWrappedStorageInstance<RxDocType, Internals, InstanceCreationOptions, CheckpointType>(database: RxDatabase<{}, Internals, InstanceCreationOptions>, storageInstance: RxStorageInstance<RxDocType, Internals, InstanceCreationOptions, CheckpointType>, 
/**
 * The original RxJsonSchema
 * before it was mutated by hooks.
 */
rxJsonSchema: RxJsonSchema<RxDocumentData<RxDocType>>): WrappedRxStorageInstance<RxDocType, Internals, InstanceCreationOptions>;
/**
 * Each RxStorage implementation should
 * run this method at the first step of createStorageInstance()
 * to ensure that the configuration is correct.
 */
export declare function ensureRxStorageInstanceParamsAreCorrect(params: RxStorageInstanceCreationParams<any, any>): void;
export declare function hasEncryption(jsonSchema: RxJsonSchema<any>): boolean;
