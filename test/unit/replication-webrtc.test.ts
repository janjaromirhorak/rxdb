import assert from 'assert';
import config from './config.ts';

import * as schemaObjects from '../helper/schema-objects.ts';
import * as humansCollection from '../helper/humans-collection.ts';

import {
    randomCouchString,
    RxCollection,
    defaultHashSha256,
    ensureNotFalsy
} from '../../plugins/core/index.mjs';

import {
    replicateWebRTC,
    RxWebRTCReplicationPool,
    // getConnectionHandlerP2PCF,
    isMasterInWebRTCReplication,
    getConnectionHandlerSimplePeer
} from '../../plugins/replication-webrtc/index.mjs';

import { randomString, wait, waitUntil } from 'async-test-util';

describe('replication-webrtc.test.ts', () => {
    if (config.platform.isNode() || config.isDeno) {
        /**
         * We cannot run these tests in Node.js
         * because the node WebRTC polyfill is broken
         * and does not work on mac.
         * @link https://github.com/node-webrtc/node-webrtc/issues/729
         */
        return;
    }

    if (
        !config.storage.hasPersistence ||
        config.storage.name === 'memory' // TODO this fails in the CI but works locally
    ) {
        return;
    }

    if (config.storage.name === 'lokijs') {
        /**
         * TODO for whatever reason this test
         * randomly does not work in the browser with lokijs
         */
        return;
    }

    let wrtc: any;
    const signalingServerUrl: string = 'ws://localhost:18006';
    describe('utils', () => {
        describe('.isMasterInWebRTCReplication()', () => {
            new Array(10).fill(0).forEach(() => {
                const id1 = randomString(7);
                const id2 = randomString(7);
                it('should have exactly one master ' + id1 + ' - ' + id2, async () => {
                    const isMasterA = await isMasterInWebRTCReplication(defaultHashSha256, id1, id2);
                    const isMasterB = await isMasterInWebRTCReplication(defaultHashSha256, id2, id1);
                    assert.ok(isMasterA !== isMasterB);
                });
            });
        });
    });

    function ensureReplicationHasNoErrors(replicationPool: RxWebRTCReplicationPool<any>) {
        /**
         * We do not have to unsubscribe because the observable will cancel anyway.
         */
        replicationPool.error$.subscribe(err => {
            console.error('ensureReplicationHasNoErrors() has error:');
            console.log(err);
            if (err?.parameters?.errors) {
                throw err.parameters.errors[0];
            }
            throw err;
        });
    }

    async function getJson<RxDocType>(collection: RxCollection<RxDocType>) {
        const docs = await collection.find().exec();
        return docs.map((d: any) => d.toJSON());
    }

    async function awaitCollectionsInSync<RxDocType>(collections: RxCollection<RxDocType>[]) {
        const last = ensureNotFalsy(collections.pop());
        await waitUntil(async () => {
            const lastJSON = await getJson(last);
            for (const collection of collections) {
                const json = await getJson(collection);
                try {
                    assert.deepStrictEqual(
                        lastJSON,
                        json
                    );
                    return true;
                } catch (err) {
                    return false;
                }
            }
        });
    }

    async function syncCollections<RxDocType>(
        topic: string,
        secret: string,
        collections: RxCollection<RxDocType>[]
    ): Promise<RxWebRTCReplicationPool<RxDocType>[]> {
        const ret = await Promise.all(
            collections.map(async (collection) => {
                const replicationPool = await replicateWebRTC<RxDocType>({
                    collection,
                    topic,
                    secret,
                    // connectionHandlerCreator: getConnectionHandlerWebtorrent([webtorrentTrackerUrl]),
                    // connectionHandlerCreator: getConnectionHandlerP2PCF(),
                    connectionHandlerCreator: getConnectionHandlerSimplePeer(signalingServerUrl, wrtc),
                    pull: {},
                    push: {}
                });
                ensureReplicationHasNoErrors(replicationPool);
                return replicationPool;
            })
        );

        /**
         * If we have more then one collection,
         * ensure that at least one peer exists each.
         */
        await Promise.all(
            ret.map(pool => pool.awaitFirstPeer())
        );
        return ret;
    }

    describe('basic CRUD', () => {
        if (config.isFastMode()) {
            return;
        }
        /**
         * Creating a WebRTC connection takes really long,
         * so we have to use a big test to test all functionality at once
         * without to re-create connections.
         */
        it('should stream changes over the replication to other collections', async function () {
            const c1 = await humansCollection.create(1, 'aaa');
            const c2 = await humansCollection.create(1, 'bbb');

            // initial sync
            const topic = randomCouchString(10);
            const secret = randomCouchString(10);
            await syncCollections(topic, secret, [c1, c2]);

            await awaitCollectionsInSync([c1, c2]);
            await wait(100);


            // insert
            await c1.insert(schemaObjects.human('inserted-after-first-sync'));
            await awaitCollectionsInSync([c1, c2]);
            await wait(100);

            // update
            const doc = await c1.findOne().exec(true);
            await doc.getLatest().incrementalPatch({ age: 100 });
            await awaitCollectionsInSync([c1, c2]);
            assert.strictEqual(doc.getLatest().age, 100);
            await wait(100);

            // delete
            await doc.getLatest().remove();
            await awaitCollectionsInSync([c1, c2]);
            await wait(100);

            // add another collection to sync
            const c3 = await humansCollection.create(1, 'ccc');
            await syncCollections(topic, secret, [c3]);
            await awaitCollectionsInSync([c1, c2, c3]);

            // remove one peer
            await c2.database.destroy();

            c1.database.destroy();
            c3.database.destroy();
        });
    });
    describe('ISSUES', () => { });
});
