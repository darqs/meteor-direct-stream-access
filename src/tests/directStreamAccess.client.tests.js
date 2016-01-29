const expect = chai.expect;

if (Meteor.isServer) {
    Meteor.methods({
        methodWithSpecifiedResponse: (response) => response
    });
}

if (Meteor.isClient) {
    describe('DirectStreamAccess', () => {
        describe('#_install()', () => {
            it('should install itself properly', () => {
                expect(DDPCommon._parseDDP).not.to.be.undefined();
                expect(DDPCommon.parseDDP).not.to.be.equal(DDPCommon._parseDDP);
            });
        });

        describe('#registerMessageHandler()', () => {
            let testDone;
            const messageHandler = (message) => {
                console.log('yyy', message);
                if (~message.indexOf('testResponse')) {
                    testDone();
                }
            };

            before(() => {
                console.log('przed rej', Meteor.directStream._messageHandlers);
                // We will register the wrapped `testDone` callback as a message handler so once its called it will also finish the test.
                Meteor.directStream.registerMessageHandler(messageHandler);
            });
            it('should register callback and receive messages', (done) => {
                testDone = done;
                // We need to generate some traffic on the websocket. We will call a method to get a response message.
                Meteor.call('methodWithSpecifiedResponse', 'testResponse');
            });
            after(() => {
                Meteor.directStream._messageHandlers = [];
            });
        });

        describe('#preventCallingMeteorHandler', () => {
            let debug;

            before(() => {
                Meteor.directStream.registerMessageHandler(function messageHandler(message) {
                    console.log('got ' + message);
                    // Selectively prevent Meteor's handler only on message `test`.
                    if (message === 'test') {
                        this.preventCallingMeteorHandler();
                    }
                });
                debug = Meteor._debug;
            });

            it('should prevent from running a meteor method', (done) => {
                let debugCalled = false;
                /**
                 * We will check if Meteor will complain about invalid JSON through the Meteor._debug method.
                 * Since we are blocking the message `test` from being processed by Meteor, only `test2` should land in
                 * the _debug method.
                 **/
                Meteor._debug = function _debug() {
                    console.log(arguments);
                    if (typeof arguments[1] === 'string') {
                        console.log('check');
                        expect(arguments[1]).to.be.equal('test2');
                        debugCalled = true;
                    }
                };
                Meteor.call('sendMessageFromServerToClient', 'test');
                Meteor.call('sendMessageFromServerToClient', 'test2', () => {
                    console.log('done');
                    expect(debugCalled).to.be.true();
                    done();
                });
            });

            after(() => {
                Meteor.directStream._messageHandlers = [];
                Meteor._debug = debug;
            });
        });
    });
}
