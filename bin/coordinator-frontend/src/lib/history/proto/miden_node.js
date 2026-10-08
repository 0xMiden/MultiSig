/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const miden = $root.miden = (() => {

    /**
     * Namespace miden.
     * @exports miden
     * @namespace
     */
    const miden = {};

    miden.node = (function() {

        /**
         * Namespace node.
         * @memberof miden
         * @namespace
         */
        const node = {};

        node.v1 = (function() {

            /**
             * Namespace v1.
             * @memberof miden.node
             * @namespace
             */
            const v1 = {};

            v1.StatusRequest = (function() {

                /**
                 * Properties of a StatusRequest.
                 * @memberof miden.node.v1
                 * @interface IStatusRequest
                 */

                /**
                 * Constructs a new StatusRequest.
                 * @memberof miden.node.v1
                 * @classdesc Represents a StatusRequest.
                 * @implements IStatusRequest
                 * @constructor
                 * @param {miden.node.v1.IStatusRequest=} [properties] Properties to set
                 */
                function StatusRequest(properties) {
                    if (properties)
                        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                this[keys[i]] = properties[keys[i]];
                }

                /**
                 * Creates a new StatusRequest instance using the specified properties.
                 * @function create
                 * @memberof miden.node.v1.StatusRequest
                 * @static
                 * @param {miden.node.v1.IStatusRequest=} [properties] Properties to set
                 * @returns {miden.node.v1.StatusRequest} StatusRequest instance
                 */
                StatusRequest.create = function create(properties) {
                    return new StatusRequest(properties);
                };

                /**
                 * Encodes the specified StatusRequest message. Does not implicitly {@link miden.node.v1.StatusRequest.verify|verify} messages.
                 * @function encode
                 * @memberof miden.node.v1.StatusRequest
                 * @static
                 * @param {miden.node.v1.IStatusRequest} message StatusRequest message or plain object to encode
                 * @param {$protobuf.Writer} [writer] Writer to encode to
                 * @returns {$protobuf.Writer} Writer
                 */
                StatusRequest.encode = function encode(message, writer, q) {
                    if (!writer)
                        writer = $Writer.create();
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    return writer;
                };

                /**
                 * Decodes a StatusRequest message from the specified reader or buffer.
                 * @function decode
                 * @memberof miden.node.v1.StatusRequest
                 * @static
                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                 * @param {number} [length] Message length if known beforehand
                 * @returns {miden.node.v1.StatusRequest} StatusRequest
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                StatusRequest.decode = function decode(reader, length, error, long) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    if (long === undefined)
                        long = 0;
                    if (long > $Reader.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let end, message;
                    if (length === undefined)
                        end = reader.len;
                    else {
                        end = reader.pos + length;
                        if (end > reader.len)
                            throw RangeError("index out of range");
                        length = reader.len;
                        reader.len = end;
                    }
                    message = new $root.miden.node.v1.StatusRequest();
                    while (reader.pos < end) {
                        let tag = reader.uint32();
                        if (tag === error)
                            break;
                        switch (tag >>> 3) {
                        default:
                            reader.skipType(tag & 7, long);
                            break;
                        }
                    }
                    if (length !== undefined) {
                        if (reader.pos !== end)
                            throw RangeError("index out of range");
                        reader.len = length;
                    }
                    return message;
                };

                /**
                 * Creates a StatusRequest message from a plain object. Also converts values to their respective internal types.
                 * @function fromObject
                 * @memberof miden.node.v1.StatusRequest
                 * @static
                 * @param {Object.<string,*>} object Plain object
                 * @returns {miden.node.v1.StatusRequest} StatusRequest
                 */
                StatusRequest.fromObject = function fromObject(object, long) {
                    if (object instanceof $root.miden.node.v1.StatusRequest)
                        return object;
                    return new $root.miden.node.v1.StatusRequest();
                };

                /**
                 * Creates a plain object from a StatusRequest message. Also converts values to other types if specified.
                 * @function toObject
                 * @memberof miden.node.v1.StatusRequest
                 * @static
                 * @param {miden.node.v1.StatusRequest} message StatusRequest
                 * @param {$protobuf.IConversionOptions} [options] Conversion options
                 * @returns {Object.<string,*>} Plain object
                 */
                StatusRequest.toObject = function toObject() {
                    return {};
                };

                /**
                 * Converts this StatusRequest to JSON.
                 * @function toJSON
                 * @memberof miden.node.v1.StatusRequest
                 * @instance
                 * @returns {Object.<string,*>} JSON object
                 */
                StatusRequest.prototype.toJSON = function toJSON() {
                    return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                };

                /**
                 * Gets the default type url for StatusRequest
                 * @function getTypeUrl
                 * @memberof miden.node.v1.StatusRequest
                 * @static
                 * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns {string} The default type url
                 */
                StatusRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                    if (typeUrlPrefix === undefined) {
                        typeUrlPrefix = "type.googleapis.com";
                    }
                    return typeUrlPrefix + "/miden.node.v1.StatusRequest";
                };

                return StatusRequest;
            })();

            v1.StatusResponse = (function() {

                /**
                 * Properties of a StatusResponse.
                 * @memberof miden.node.v1
                 * @interface IStatusResponse
                 * @property {string|null} [version] StatusResponse version
                 * @property {primitives.IWord|null} [genesisCommitment] StatusResponse genesisCommitment
                 * @property {number|null} [chainTip] StatusResponse chainTip
                 * @property {miden.node.v1.IBlockProducerStatus|null} [blockProducer] StatusResponse blockProducer
                 */

                /**
                 * Constructs a new StatusResponse.
                 * @memberof miden.node.v1
                 * @classdesc Represents a StatusResponse.
                 * @implements IStatusResponse
                 * @constructor
                 * @param {miden.node.v1.IStatusResponse=} [properties] Properties to set
                 */
                function StatusResponse(properties) {
                    if (properties)
                        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                this[keys[i]] = properties[keys[i]];
                }

                /**
                 * StatusResponse version.
                 * @member {string} version
                 * @memberof miden.node.v1.StatusResponse
                 * @instance
                 */
                StatusResponse.prototype.version = "";

                /**
                 * StatusResponse genesisCommitment.
                 * @member {primitives.IWord|null|undefined} genesisCommitment
                 * @memberof miden.node.v1.StatusResponse
                 * @instance
                 */
                StatusResponse.prototype.genesisCommitment = null;

                /**
                 * StatusResponse chainTip.
                 * @member {number} chainTip
                 * @memberof miden.node.v1.StatusResponse
                 * @instance
                 */
                StatusResponse.prototype.chainTip = 0;

                /**
                 * StatusResponse blockProducer.
                 * @member {miden.node.v1.IBlockProducerStatus|null|undefined} blockProducer
                 * @memberof miden.node.v1.StatusResponse
                 * @instance
                 */
                StatusResponse.prototype.blockProducer = null;

                /**
                 * Creates a new StatusResponse instance using the specified properties.
                 * @function create
                 * @memberof miden.node.v1.StatusResponse
                 * @static
                 * @param {miden.node.v1.IStatusResponse=} [properties] Properties to set
                 * @returns {miden.node.v1.StatusResponse} StatusResponse instance
                 */
                StatusResponse.create = function create(properties) {
                    return new StatusResponse(properties);
                };

                /**
                 * Encodes the specified StatusResponse message. Does not implicitly {@link miden.node.v1.StatusResponse.verify|verify} messages.
                 * @function encode
                 * @memberof miden.node.v1.StatusResponse
                 * @static
                 * @param {miden.node.v1.IStatusResponse} message StatusResponse message or plain object to encode
                 * @param {$protobuf.Writer} [writer] Writer to encode to
                 * @returns {$protobuf.Writer} Writer
                 */
                StatusResponse.encode = function encode(message, writer, q) {
                    if (!writer)
                        writer = $Writer.create();
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    if (message.version != null && Object.hasOwnProperty.call(message, "version"))
                        writer.uint32(/* id 1, wireType 2 =*/10).string(message.version);
                    if (message.genesisCommitment != null && Object.hasOwnProperty.call(message, "genesisCommitment"))
                        $root.primitives.Word.encode(message.genesisCommitment, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
                    if (message.chainTip != null && Object.hasOwnProperty.call(message, "chainTip"))
                        writer.uint32(/* id 3, wireType 5 =*/29).fixed32(message.chainTip);
                    if (message.blockProducer != null && Object.hasOwnProperty.call(message, "blockProducer"))
                        $root.miden.node.v1.BlockProducerStatus.encode(message.blockProducer, writer.uint32(/* id 4, wireType 2 =*/34).fork(), q + 1).ldelim();
                    return writer;
                };

                /**
                 * Decodes a StatusResponse message from the specified reader or buffer.
                 * @function decode
                 * @memberof miden.node.v1.StatusResponse
                 * @static
                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                 * @param {number} [length] Message length if known beforehand
                 * @returns {miden.node.v1.StatusResponse} StatusResponse
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                StatusResponse.decode = function decode(reader, length, error, long) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    if (long === undefined)
                        long = 0;
                    if (long > $Reader.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let end, message;
                    if (length === undefined)
                        end = reader.len;
                    else {
                        end = reader.pos + length;
                        if (end > reader.len)
                            throw RangeError("index out of range");
                        length = reader.len;
                        reader.len = end;
                    }
                    message = new $root.miden.node.v1.StatusResponse();
                    while (reader.pos < end) {
                        let tag = reader.uint32();
                        if (tag === error)
                            break;
                        switch (tag >>> 3) {
                        case 1: {
                                message.version = reader.string();
                                break;
                            }
                        case 2: {
                                message.genesisCommitment = $root.primitives.Word.decode(reader, reader.uint32(), undefined, long + 1);
                                break;
                            }
                        case 3: {
                                message.chainTip = reader.fixed32();
                                break;
                            }
                        case 4: {
                                message.blockProducer = $root.miden.node.v1.BlockProducerStatus.decode(reader, reader.uint32(), undefined, long + 1);
                                break;
                            }
                        default:
                            reader.skipType(tag & 7, long);
                            break;
                        }
                    }
                    if (length !== undefined) {
                        if (reader.pos !== end)
                            throw RangeError("index out of range");
                        reader.len = length;
                    }
                    return message;
                };

                /**
                 * Creates a StatusResponse message from a plain object. Also converts values to their respective internal types.
                 * @function fromObject
                 * @memberof miden.node.v1.StatusResponse
                 * @static
                 * @param {Object.<string,*>} object Plain object
                 * @returns {miden.node.v1.StatusResponse} StatusResponse
                 */
                StatusResponse.fromObject = function fromObject(object, long) {
                    if (object instanceof $root.miden.node.v1.StatusResponse)
                        return object;
                    if (!$util.isObject(object))
                        throw TypeError(".miden.node.v1.StatusResponse: object expected");
                    if (long === undefined)
                        long = 0;
                    if (long > $util.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let message = new $root.miden.node.v1.StatusResponse();
                    if (object.version != null)
                        message.version = String(object.version);
                    if (object.genesisCommitment != null) {
                        if (!$util.isObject(object.genesisCommitment))
                            throw TypeError(".miden.node.v1.StatusResponse.genesisCommitment: object expected");
                        message.genesisCommitment = $root.primitives.Word.fromObject(object.genesisCommitment, long + 1);
                    }
                    if (object.chainTip != null)
                        message.chainTip = object.chainTip >>> 0;
                    if (object.blockProducer != null) {
                        if (!$util.isObject(object.blockProducer))
                            throw TypeError(".miden.node.v1.StatusResponse.blockProducer: object expected");
                        message.blockProducer = $root.miden.node.v1.BlockProducerStatus.fromObject(object.blockProducer, long + 1);
                    }
                    return message;
                };

                /**
                 * Creates a plain object from a StatusResponse message. Also converts values to other types if specified.
                 * @function toObject
                 * @memberof miden.node.v1.StatusResponse
                 * @static
                 * @param {miden.node.v1.StatusResponse} message StatusResponse
                 * @param {$protobuf.IConversionOptions} [options] Conversion options
                 * @returns {Object.<string,*>} Plain object
                 */
                StatusResponse.toObject = function toObject(message, options, q) {
                    if (!options)
                        options = {};
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    let object = {};
                    if (options.defaults) {
                        object.version = "";
                        object.genesisCommitment = null;
                        object.chainTip = 0;
                        object.blockProducer = null;
                    }
                    if (message.version != null && Object.hasOwnProperty.call(message, "version"))
                        object.version = message.version;
                    if (message.genesisCommitment != null && Object.hasOwnProperty.call(message, "genesisCommitment"))
                        object.genesisCommitment = $root.primitives.Word.toObject(message.genesisCommitment, options, q + 1);
                    if (message.chainTip != null && Object.hasOwnProperty.call(message, "chainTip"))
                        object.chainTip = message.chainTip;
                    if (message.blockProducer != null && Object.hasOwnProperty.call(message, "blockProducer"))
                        object.blockProducer = $root.miden.node.v1.BlockProducerStatus.toObject(message.blockProducer, options, q + 1);
                    return object;
                };

                /**
                 * Converts this StatusResponse to JSON.
                 * @function toJSON
                 * @memberof miden.node.v1.StatusResponse
                 * @instance
                 * @returns {Object.<string,*>} JSON object
                 */
                StatusResponse.prototype.toJSON = function toJSON() {
                    return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                };

                /**
                 * Gets the default type url for StatusResponse
                 * @function getTypeUrl
                 * @memberof miden.node.v1.StatusResponse
                 * @static
                 * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns {string} The default type url
                 */
                StatusResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                    if (typeUrlPrefix === undefined) {
                        typeUrlPrefix = "type.googleapis.com";
                    }
                    return typeUrlPrefix + "/miden.node.v1.StatusResponse";
                };

                return StatusResponse;
            })();

            v1.BlockProducerStatus = (function() {

                /**
                 * Properties of a BlockProducerStatus.
                 * @memberof miden.node.v1
                 * @interface IBlockProducerStatus
                 * @property {string|null} [version] BlockProducerStatus version
                 * @property {string|null} [status] BlockProducerStatus status
                 * @property {number|null} [chainTip] BlockProducerStatus chainTip
                 * @property {miden.node.v1.IMempoolStats|null} [mempoolStats] BlockProducerStatus mempoolStats
                 */

                /**
                 * Constructs a new BlockProducerStatus.
                 * @memberof miden.node.v1
                 * @classdesc Represents a BlockProducerStatus.
                 * @implements IBlockProducerStatus
                 * @constructor
                 * @param {miden.node.v1.IBlockProducerStatus=} [properties] Properties to set
                 */
                function BlockProducerStatus(properties) {
                    if (properties)
                        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                this[keys[i]] = properties[keys[i]];
                }

                /**
                 * BlockProducerStatus version.
                 * @member {string} version
                 * @memberof miden.node.v1.BlockProducerStatus
                 * @instance
                 */
                BlockProducerStatus.prototype.version = "";

                /**
                 * BlockProducerStatus status.
                 * @member {string} status
                 * @memberof miden.node.v1.BlockProducerStatus
                 * @instance
                 */
                BlockProducerStatus.prototype.status = "";

                /**
                 * BlockProducerStatus chainTip.
                 * @member {number} chainTip
                 * @memberof miden.node.v1.BlockProducerStatus
                 * @instance
                 */
                BlockProducerStatus.prototype.chainTip = 0;

                /**
                 * BlockProducerStatus mempoolStats.
                 * @member {miden.node.v1.IMempoolStats|null|undefined} mempoolStats
                 * @memberof miden.node.v1.BlockProducerStatus
                 * @instance
                 */
                BlockProducerStatus.prototype.mempoolStats = null;

                /**
                 * Creates a new BlockProducerStatus instance using the specified properties.
                 * @function create
                 * @memberof miden.node.v1.BlockProducerStatus
                 * @static
                 * @param {miden.node.v1.IBlockProducerStatus=} [properties] Properties to set
                 * @returns {miden.node.v1.BlockProducerStatus} BlockProducerStatus instance
                 */
                BlockProducerStatus.create = function create(properties) {
                    return new BlockProducerStatus(properties);
                };

                /**
                 * Encodes the specified BlockProducerStatus message. Does not implicitly {@link miden.node.v1.BlockProducerStatus.verify|verify} messages.
                 * @function encode
                 * @memberof miden.node.v1.BlockProducerStatus
                 * @static
                 * @param {miden.node.v1.IBlockProducerStatus} message BlockProducerStatus message or plain object to encode
                 * @param {$protobuf.Writer} [writer] Writer to encode to
                 * @returns {$protobuf.Writer} Writer
                 */
                BlockProducerStatus.encode = function encode(message, writer, q) {
                    if (!writer)
                        writer = $Writer.create();
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    if (message.version != null && Object.hasOwnProperty.call(message, "version"))
                        writer.uint32(/* id 1, wireType 2 =*/10).string(message.version);
                    if (message.status != null && Object.hasOwnProperty.call(message, "status"))
                        writer.uint32(/* id 2, wireType 2 =*/18).string(message.status);
                    if (message.mempoolStats != null && Object.hasOwnProperty.call(message, "mempoolStats"))
                        $root.miden.node.v1.MempoolStats.encode(message.mempoolStats, writer.uint32(/* id 3, wireType 2 =*/26).fork(), q + 1).ldelim();
                    if (message.chainTip != null && Object.hasOwnProperty.call(message, "chainTip"))
                        writer.uint32(/* id 4, wireType 5 =*/37).fixed32(message.chainTip);
                    return writer;
                };

                /**
                 * Decodes a BlockProducerStatus message from the specified reader or buffer.
                 * @function decode
                 * @memberof miden.node.v1.BlockProducerStatus
                 * @static
                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                 * @param {number} [length] Message length if known beforehand
                 * @returns {miden.node.v1.BlockProducerStatus} BlockProducerStatus
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                BlockProducerStatus.decode = function decode(reader, length, error, long) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    if (long === undefined)
                        long = 0;
                    if (long > $Reader.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let end, message;
                    if (length === undefined)
                        end = reader.len;
                    else {
                        end = reader.pos + length;
                        if (end > reader.len)
                            throw RangeError("index out of range");
                        length = reader.len;
                        reader.len = end;
                    }
                    message = new $root.miden.node.v1.BlockProducerStatus();
                    while (reader.pos < end) {
                        let tag = reader.uint32();
                        if (tag === error)
                            break;
                        switch (tag >>> 3) {
                        case 1: {
                                message.version = reader.string();
                                break;
                            }
                        case 2: {
                                message.status = reader.string();
                                break;
                            }
                        case 4: {
                                message.chainTip = reader.fixed32();
                                break;
                            }
                        case 3: {
                                message.mempoolStats = $root.miden.node.v1.MempoolStats.decode(reader, reader.uint32(), undefined, long + 1);
                                break;
                            }
                        default:
                            reader.skipType(tag & 7, long);
                            break;
                        }
                    }
                    if (length !== undefined) {
                        if (reader.pos !== end)
                            throw RangeError("index out of range");
                        reader.len = length;
                    }
                    return message;
                };

                /**
                 * Creates a BlockProducerStatus message from a plain object. Also converts values to their respective internal types.
                 * @function fromObject
                 * @memberof miden.node.v1.BlockProducerStatus
                 * @static
                 * @param {Object.<string,*>} object Plain object
                 * @returns {miden.node.v1.BlockProducerStatus} BlockProducerStatus
                 */
                BlockProducerStatus.fromObject = function fromObject(object, long) {
                    if (object instanceof $root.miden.node.v1.BlockProducerStatus)
                        return object;
                    if (!$util.isObject(object))
                        throw TypeError(".miden.node.v1.BlockProducerStatus: object expected");
                    if (long === undefined)
                        long = 0;
                    if (long > $util.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let message = new $root.miden.node.v1.BlockProducerStatus();
                    if (object.version != null)
                        message.version = String(object.version);
                    if (object.status != null)
                        message.status = String(object.status);
                    if (object.chainTip != null)
                        message.chainTip = object.chainTip >>> 0;
                    if (object.mempoolStats != null) {
                        if (!$util.isObject(object.mempoolStats))
                            throw TypeError(".miden.node.v1.BlockProducerStatus.mempoolStats: object expected");
                        message.mempoolStats = $root.miden.node.v1.MempoolStats.fromObject(object.mempoolStats, long + 1);
                    }
                    return message;
                };

                /**
                 * Creates a plain object from a BlockProducerStatus message. Also converts values to other types if specified.
                 * @function toObject
                 * @memberof miden.node.v1.BlockProducerStatus
                 * @static
                 * @param {miden.node.v1.BlockProducerStatus} message BlockProducerStatus
                 * @param {$protobuf.IConversionOptions} [options] Conversion options
                 * @returns {Object.<string,*>} Plain object
                 */
                BlockProducerStatus.toObject = function toObject(message, options, q) {
                    if (!options)
                        options = {};
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    let object = {};
                    if (options.defaults) {
                        object.version = "";
                        object.status = "";
                        object.mempoolStats = null;
                        object.chainTip = 0;
                    }
                    if (message.version != null && Object.hasOwnProperty.call(message, "version"))
                        object.version = message.version;
                    if (message.status != null && Object.hasOwnProperty.call(message, "status"))
                        object.status = message.status;
                    if (message.mempoolStats != null && Object.hasOwnProperty.call(message, "mempoolStats"))
                        object.mempoolStats = $root.miden.node.v1.MempoolStats.toObject(message.mempoolStats, options, q + 1);
                    if (message.chainTip != null && Object.hasOwnProperty.call(message, "chainTip"))
                        object.chainTip = message.chainTip;
                    return object;
                };

                /**
                 * Converts this BlockProducerStatus to JSON.
                 * @function toJSON
                 * @memberof miden.node.v1.BlockProducerStatus
                 * @instance
                 * @returns {Object.<string,*>} JSON object
                 */
                BlockProducerStatus.prototype.toJSON = function toJSON() {
                    return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                };

                /**
                 * Gets the default type url for BlockProducerStatus
                 * @function getTypeUrl
                 * @memberof miden.node.v1.BlockProducerStatus
                 * @static
                 * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns {string} The default type url
                 */
                BlockProducerStatus.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                    if (typeUrlPrefix === undefined) {
                        typeUrlPrefix = "type.googleapis.com";
                    }
                    return typeUrlPrefix + "/miden.node.v1.BlockProducerStatus";
                };

                return BlockProducerStatus;
            })();

            v1.MempoolStats = (function() {

                /**
                 * Properties of a MempoolStats.
                 * @memberof miden.node.v1
                 * @interface IMempoolStats
                 * @property {number|Long|null} [unbatchedTransactions] MempoolStats unbatchedTransactions
                 * @property {number|Long|null} [proposedBatches] MempoolStats proposedBatches
                 * @property {number|Long|null} [provenBatches] MempoolStats provenBatches
                 * @property {number|Long|null} [uncommittedTransactions] MempoolStats uncommittedTransactions
                 */

                /**
                 * Constructs a new MempoolStats.
                 * @memberof miden.node.v1
                 * @classdesc Represents a MempoolStats.
                 * @implements IMempoolStats
                 * @constructor
                 * @param {miden.node.v1.IMempoolStats=} [properties] Properties to set
                 */
                function MempoolStats(properties) {
                    if (properties)
                        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                this[keys[i]] = properties[keys[i]];
                }

                /**
                 * MempoolStats unbatchedTransactions.
                 * @member {number|Long} unbatchedTransactions
                 * @memberof miden.node.v1.MempoolStats
                 * @instance
                 */
                MempoolStats.prototype.unbatchedTransactions = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

                /**
                 * MempoolStats proposedBatches.
                 * @member {number|Long} proposedBatches
                 * @memberof miden.node.v1.MempoolStats
                 * @instance
                 */
                MempoolStats.prototype.proposedBatches = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

                /**
                 * MempoolStats provenBatches.
                 * @member {number|Long} provenBatches
                 * @memberof miden.node.v1.MempoolStats
                 * @instance
                 */
                MempoolStats.prototype.provenBatches = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

                /**
                 * MempoolStats uncommittedTransactions.
                 * @member {number|Long} uncommittedTransactions
                 * @memberof miden.node.v1.MempoolStats
                 * @instance
                 */
                MempoolStats.prototype.uncommittedTransactions = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

                /**
                 * Creates a new MempoolStats instance using the specified properties.
                 * @function create
                 * @memberof miden.node.v1.MempoolStats
                 * @static
                 * @param {miden.node.v1.IMempoolStats=} [properties] Properties to set
                 * @returns {miden.node.v1.MempoolStats} MempoolStats instance
                 */
                MempoolStats.create = function create(properties) {
                    return new MempoolStats(properties);
                };

                /**
                 * Encodes the specified MempoolStats message. Does not implicitly {@link miden.node.v1.MempoolStats.verify|verify} messages.
                 * @function encode
                 * @memberof miden.node.v1.MempoolStats
                 * @static
                 * @param {miden.node.v1.IMempoolStats} message MempoolStats message or plain object to encode
                 * @param {$protobuf.Writer} [writer] Writer to encode to
                 * @returns {$protobuf.Writer} Writer
                 */
                MempoolStats.encode = function encode(message, writer, q) {
                    if (!writer)
                        writer = $Writer.create();
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    if (message.unbatchedTransactions != null && Object.hasOwnProperty.call(message, "unbatchedTransactions"))
                        writer.uint32(/* id 1, wireType 0 =*/8).uint64(message.unbatchedTransactions);
                    if (message.proposedBatches != null && Object.hasOwnProperty.call(message, "proposedBatches"))
                        writer.uint32(/* id 2, wireType 0 =*/16).uint64(message.proposedBatches);
                    if (message.provenBatches != null && Object.hasOwnProperty.call(message, "provenBatches"))
                        writer.uint32(/* id 3, wireType 0 =*/24).uint64(message.provenBatches);
                    if (message.uncommittedTransactions != null && Object.hasOwnProperty.call(message, "uncommittedTransactions"))
                        writer.uint32(/* id 4, wireType 0 =*/32).uint64(message.uncommittedTransactions);
                    return writer;
                };

                /**
                 * Decodes a MempoolStats message from the specified reader or buffer.
                 * @function decode
                 * @memberof miden.node.v1.MempoolStats
                 * @static
                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                 * @param {number} [length] Message length if known beforehand
                 * @returns {miden.node.v1.MempoolStats} MempoolStats
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                MempoolStats.decode = function decode(reader, length, error, long) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    if (long === undefined)
                        long = 0;
                    if (long > $Reader.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let end, message;
                    if (length === undefined)
                        end = reader.len;
                    else {
                        end = reader.pos + length;
                        if (end > reader.len)
                            throw RangeError("index out of range");
                        length = reader.len;
                        reader.len = end;
                    }
                    message = new $root.miden.node.v1.MempoolStats();
                    while (reader.pos < end) {
                        let tag = reader.uint32();
                        if (tag === error)
                            break;
                        switch (tag >>> 3) {
                        case 1: {
                                message.unbatchedTransactions = reader.uint64();
                                break;
                            }
                        case 2: {
                                message.proposedBatches = reader.uint64();
                                break;
                            }
                        case 3: {
                                message.provenBatches = reader.uint64();
                                break;
                            }
                        case 4: {
                                message.uncommittedTransactions = reader.uint64();
                                break;
                            }
                        default:
                            reader.skipType(tag & 7, long);
                            break;
                        }
                    }
                    if (length !== undefined) {
                        if (reader.pos !== end)
                            throw RangeError("index out of range");
                        reader.len = length;
                    }
                    return message;
                };

                /**
                 * Creates a MempoolStats message from a plain object. Also converts values to their respective internal types.
                 * @function fromObject
                 * @memberof miden.node.v1.MempoolStats
                 * @static
                 * @param {Object.<string,*>} object Plain object
                 * @returns {miden.node.v1.MempoolStats} MempoolStats
                 */
                MempoolStats.fromObject = function fromObject(object, long) {
                    if (object instanceof $root.miden.node.v1.MempoolStats)
                        return object;
                    if (!$util.isObject(object))
                        throw TypeError(".miden.node.v1.MempoolStats: object expected");
                    if (long === undefined)
                        long = 0;
                    if (long > $util.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let message = new $root.miden.node.v1.MempoolStats();
                    if (object.unbatchedTransactions != null)
                        if ($util.Long)
                            message.unbatchedTransactions = $util.Long.fromValue(object.unbatchedTransactions, true);
                        else if (typeof object.unbatchedTransactions === "string")
                            message.unbatchedTransactions = parseInt(object.unbatchedTransactions, 10);
                        else if (typeof object.unbatchedTransactions === "number")
                            message.unbatchedTransactions = object.unbatchedTransactions;
                        else if (typeof object.unbatchedTransactions === "object")
                            message.unbatchedTransactions = new $util.LongBits(object.unbatchedTransactions.low >>> 0, object.unbatchedTransactions.high >>> 0).toNumber(true);
                    if (object.proposedBatches != null)
                        if ($util.Long)
                            message.proposedBatches = $util.Long.fromValue(object.proposedBatches, true);
                        else if (typeof object.proposedBatches === "string")
                            message.proposedBatches = parseInt(object.proposedBatches, 10);
                        else if (typeof object.proposedBatches === "number")
                            message.proposedBatches = object.proposedBatches;
                        else if (typeof object.proposedBatches === "object")
                            message.proposedBatches = new $util.LongBits(object.proposedBatches.low >>> 0, object.proposedBatches.high >>> 0).toNumber(true);
                    if (object.provenBatches != null)
                        if ($util.Long)
                            message.provenBatches = $util.Long.fromValue(object.provenBatches, true);
                        else if (typeof object.provenBatches === "string")
                            message.provenBatches = parseInt(object.provenBatches, 10);
                        else if (typeof object.provenBatches === "number")
                            message.provenBatches = object.provenBatches;
                        else if (typeof object.provenBatches === "object")
                            message.provenBatches = new $util.LongBits(object.provenBatches.low >>> 0, object.provenBatches.high >>> 0).toNumber(true);
                    if (object.uncommittedTransactions != null)
                        if ($util.Long)
                            message.uncommittedTransactions = $util.Long.fromValue(object.uncommittedTransactions, true);
                        else if (typeof object.uncommittedTransactions === "string")
                            message.uncommittedTransactions = parseInt(object.uncommittedTransactions, 10);
                        else if (typeof object.uncommittedTransactions === "number")
                            message.uncommittedTransactions = object.uncommittedTransactions;
                        else if (typeof object.uncommittedTransactions === "object")
                            message.uncommittedTransactions = new $util.LongBits(object.uncommittedTransactions.low >>> 0, object.uncommittedTransactions.high >>> 0).toNumber(true);
                    return message;
                };

                /**
                 * Creates a plain object from a MempoolStats message. Also converts values to other types if specified.
                 * @function toObject
                 * @memberof miden.node.v1.MempoolStats
                 * @static
                 * @param {miden.node.v1.MempoolStats} message MempoolStats
                 * @param {$protobuf.IConversionOptions} [options] Conversion options
                 * @returns {Object.<string,*>} Plain object
                 */
                MempoolStats.toObject = function toObject(message, options, q) {
                    if (!options)
                        options = {};
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    let object = {};
                    if (options.defaults) {
                        if ($util.Long) {
                            let long = new $util.Long(0, 0, true);
                            object.unbatchedTransactions = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : typeof BigInt !== "undefined" && options.longs === BigInt ? long.toBigInt() : long;
                        } else
                            object.unbatchedTransactions = options.longs === String ? "0" : typeof BigInt !== "undefined" && options.longs === BigInt ? BigInt("0") : 0;
                        if ($util.Long) {
                            let long = new $util.Long(0, 0, true);
                            object.proposedBatches = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : typeof BigInt !== "undefined" && options.longs === BigInt ? long.toBigInt() : long;
                        } else
                            object.proposedBatches = options.longs === String ? "0" : typeof BigInt !== "undefined" && options.longs === BigInt ? BigInt("0") : 0;
                        if ($util.Long) {
                            let long = new $util.Long(0, 0, true);
                            object.provenBatches = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : typeof BigInt !== "undefined" && options.longs === BigInt ? long.toBigInt() : long;
                        } else
                            object.provenBatches = options.longs === String ? "0" : typeof BigInt !== "undefined" && options.longs === BigInt ? BigInt("0") : 0;
                        if ($util.Long) {
                            let long = new $util.Long(0, 0, true);
                            object.uncommittedTransactions = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : typeof BigInt !== "undefined" && options.longs === BigInt ? long.toBigInt() : long;
                        } else
                            object.uncommittedTransactions = options.longs === String ? "0" : typeof BigInt !== "undefined" && options.longs === BigInt ? BigInt("0") : 0;
                    }
                    if (message.unbatchedTransactions != null && Object.hasOwnProperty.call(message, "unbatchedTransactions"))
                        if (typeof BigInt !== "undefined" && options.longs === BigInt)
                            object.unbatchedTransactions = typeof message.unbatchedTransactions === "number" ? BigInt(message.unbatchedTransactions) : $util.Long.fromBits(message.unbatchedTransactions.low >>> 0, message.unbatchedTransactions.high >>> 0, true).toBigInt();
                        else if (typeof message.unbatchedTransactions === "number")
                            object.unbatchedTransactions = options.longs === String ? String(message.unbatchedTransactions) : message.unbatchedTransactions;
                        else
                            object.unbatchedTransactions = options.longs === String ? $util.Long.prototype.toString.call(message.unbatchedTransactions) : options.longs === Number ? new $util.LongBits(message.unbatchedTransactions.low >>> 0, message.unbatchedTransactions.high >>> 0).toNumber(true) : message.unbatchedTransactions;
                    if (message.proposedBatches != null && Object.hasOwnProperty.call(message, "proposedBatches"))
                        if (typeof BigInt !== "undefined" && options.longs === BigInt)
                            object.proposedBatches = typeof message.proposedBatches === "number" ? BigInt(message.proposedBatches) : $util.Long.fromBits(message.proposedBatches.low >>> 0, message.proposedBatches.high >>> 0, true).toBigInt();
                        else if (typeof message.proposedBatches === "number")
                            object.proposedBatches = options.longs === String ? String(message.proposedBatches) : message.proposedBatches;
                        else
                            object.proposedBatches = options.longs === String ? $util.Long.prototype.toString.call(message.proposedBatches) : options.longs === Number ? new $util.LongBits(message.proposedBatches.low >>> 0, message.proposedBatches.high >>> 0).toNumber(true) : message.proposedBatches;
                    if (message.provenBatches != null && Object.hasOwnProperty.call(message, "provenBatches"))
                        if (typeof BigInt !== "undefined" && options.longs === BigInt)
                            object.provenBatches = typeof message.provenBatches === "number" ? BigInt(message.provenBatches) : $util.Long.fromBits(message.provenBatches.low >>> 0, message.provenBatches.high >>> 0, true).toBigInt();
                        else if (typeof message.provenBatches === "number")
                            object.provenBatches = options.longs === String ? String(message.provenBatches) : message.provenBatches;
                        else
                            object.provenBatches = options.longs === String ? $util.Long.prototype.toString.call(message.provenBatches) : options.longs === Number ? new $util.LongBits(message.provenBatches.low >>> 0, message.provenBatches.high >>> 0).toNumber(true) : message.provenBatches;
                    if (message.uncommittedTransactions != null && Object.hasOwnProperty.call(message, "uncommittedTransactions"))
                        if (typeof BigInt !== "undefined" && options.longs === BigInt)
                            object.uncommittedTransactions = typeof message.uncommittedTransactions === "number" ? BigInt(message.uncommittedTransactions) : $util.Long.fromBits(message.uncommittedTransactions.low >>> 0, message.uncommittedTransactions.high >>> 0, true).toBigInt();
                        else if (typeof message.uncommittedTransactions === "number")
                            object.uncommittedTransactions = options.longs === String ? String(message.uncommittedTransactions) : message.uncommittedTransactions;
                        else
                            object.uncommittedTransactions = options.longs === String ? $util.Long.prototype.toString.call(message.uncommittedTransactions) : options.longs === Number ? new $util.LongBits(message.uncommittedTransactions.low >>> 0, message.uncommittedTransactions.high >>> 0).toNumber(true) : message.uncommittedTransactions;
                    return object;
                };

                /**
                 * Converts this MempoolStats to JSON.
                 * @function toJSON
                 * @memberof miden.node.v1.MempoolStats
                 * @instance
                 * @returns {Object.<string,*>} JSON object
                 */
                MempoolStats.prototype.toJSON = function toJSON() {
                    return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                };

                /**
                 * Gets the default type url for MempoolStats
                 * @function getTypeUrl
                 * @memberof miden.node.v1.MempoolStats
                 * @static
                 * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns {string} The default type url
                 */
                MempoolStats.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                    if (typeUrlPrefix === undefined) {
                        typeUrlPrefix = "type.googleapis.com";
                    }
                    return typeUrlPrefix + "/miden.node.v1.MempoolStats";
                };

                return MempoolStats;
            })();

            v1.BlockRange = (function() {

                /**
                 * Properties of a BlockRange.
                 * @memberof miden.node.v1
                 * @interface IBlockRange
                 * @property {number|null} [blockFrom] BlockRange blockFrom
                 * @property {number|null} [blockTo] BlockRange blockTo
                 */

                /**
                 * Constructs a new BlockRange.
                 * @memberof miden.node.v1
                 * @classdesc Represents a BlockRange.
                 * @implements IBlockRange
                 * @constructor
                 * @param {miden.node.v1.IBlockRange=} [properties] Properties to set
                 */
                function BlockRange(properties) {
                    if (properties)
                        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                this[keys[i]] = properties[keys[i]];
                }

                /**
                 * BlockRange blockFrom.
                 * @member {number} blockFrom
                 * @memberof miden.node.v1.BlockRange
                 * @instance
                 */
                BlockRange.prototype.blockFrom = 0;

                /**
                 * BlockRange blockTo.
                 * @member {number} blockTo
                 * @memberof miden.node.v1.BlockRange
                 * @instance
                 */
                BlockRange.prototype.blockTo = 0;

                /**
                 * Creates a new BlockRange instance using the specified properties.
                 * @function create
                 * @memberof miden.node.v1.BlockRange
                 * @static
                 * @param {miden.node.v1.IBlockRange=} [properties] Properties to set
                 * @returns {miden.node.v1.BlockRange} BlockRange instance
                 */
                BlockRange.create = function create(properties) {
                    return new BlockRange(properties);
                };

                /**
                 * Encodes the specified BlockRange message. Does not implicitly {@link miden.node.v1.BlockRange.verify|verify} messages.
                 * @function encode
                 * @memberof miden.node.v1.BlockRange
                 * @static
                 * @param {miden.node.v1.IBlockRange} message BlockRange message or plain object to encode
                 * @param {$protobuf.Writer} [writer] Writer to encode to
                 * @returns {$protobuf.Writer} Writer
                 */
                BlockRange.encode = function encode(message, writer, q) {
                    if (!writer)
                        writer = $Writer.create();
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    if (message.blockFrom != null && Object.hasOwnProperty.call(message, "blockFrom"))
                        writer.uint32(/* id 1, wireType 5 =*/13).fixed32(message.blockFrom);
                    if (message.blockTo != null && Object.hasOwnProperty.call(message, "blockTo"))
                        writer.uint32(/* id 2, wireType 5 =*/21).fixed32(message.blockTo);
                    return writer;
                };

                /**
                 * Decodes a BlockRange message from the specified reader or buffer.
                 * @function decode
                 * @memberof miden.node.v1.BlockRange
                 * @static
                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                 * @param {number} [length] Message length if known beforehand
                 * @returns {miden.node.v1.BlockRange} BlockRange
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                BlockRange.decode = function decode(reader, length, error, long) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    if (long === undefined)
                        long = 0;
                    if (long > $Reader.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let end, message;
                    if (length === undefined)
                        end = reader.len;
                    else {
                        end = reader.pos + length;
                        if (end > reader.len)
                            throw RangeError("index out of range");
                        length = reader.len;
                        reader.len = end;
                    }
                    message = new $root.miden.node.v1.BlockRange();
                    while (reader.pos < end) {
                        let tag = reader.uint32();
                        if (tag === error)
                            break;
                        switch (tag >>> 3) {
                        case 1: {
                                message.blockFrom = reader.fixed32();
                                break;
                            }
                        case 2: {
                                message.blockTo = reader.fixed32();
                                break;
                            }
                        default:
                            reader.skipType(tag & 7, long);
                            break;
                        }
                    }
                    if (length !== undefined) {
                        if (reader.pos !== end)
                            throw RangeError("index out of range");
                        reader.len = length;
                    }
                    return message;
                };

                /**
                 * Creates a BlockRange message from a plain object. Also converts values to their respective internal types.
                 * @function fromObject
                 * @memberof miden.node.v1.BlockRange
                 * @static
                 * @param {Object.<string,*>} object Plain object
                 * @returns {miden.node.v1.BlockRange} BlockRange
                 */
                BlockRange.fromObject = function fromObject(object, long) {
                    if (object instanceof $root.miden.node.v1.BlockRange)
                        return object;
                    if (!$util.isObject(object))
                        throw TypeError(".miden.node.v1.BlockRange: object expected");
                    if (long === undefined)
                        long = 0;
                    if (long > $util.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let message = new $root.miden.node.v1.BlockRange();
                    if (object.blockFrom != null)
                        message.blockFrom = object.blockFrom >>> 0;
                    if (object.blockTo != null)
                        message.blockTo = object.blockTo >>> 0;
                    return message;
                };

                /**
                 * Creates a plain object from a BlockRange message. Also converts values to other types if specified.
                 * @function toObject
                 * @memberof miden.node.v1.BlockRange
                 * @static
                 * @param {miden.node.v1.BlockRange} message BlockRange
                 * @param {$protobuf.IConversionOptions} [options] Conversion options
                 * @returns {Object.<string,*>} Plain object
                 */
                BlockRange.toObject = function toObject(message, options, q) {
                    if (!options)
                        options = {};
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    let object = {};
                    if (options.defaults) {
                        object.blockFrom = 0;
                        object.blockTo = 0;
                    }
                    if (message.blockFrom != null && Object.hasOwnProperty.call(message, "blockFrom"))
                        object.blockFrom = message.blockFrom;
                    if (message.blockTo != null && Object.hasOwnProperty.call(message, "blockTo"))
                        object.blockTo = message.blockTo;
                    return object;
                };

                /**
                 * Converts this BlockRange to JSON.
                 * @function toJSON
                 * @memberof miden.node.v1.BlockRange
                 * @instance
                 * @returns {Object.<string,*>} JSON object
                 */
                BlockRange.prototype.toJSON = function toJSON() {
                    return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                };

                /**
                 * Gets the default type url for BlockRange
                 * @function getTypeUrl
                 * @memberof miden.node.v1.BlockRange
                 * @static
                 * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns {string} The default type url
                 */
                BlockRange.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                    if (typeUrlPrefix === undefined) {
                        typeUrlPrefix = "type.googleapis.com";
                    }
                    return typeUrlPrefix + "/miden.node.v1.BlockRange";
                };

                return BlockRange;
            })();

            v1.PaginationInfo = (function() {

                /**
                 * Properties of a PaginationInfo.
                 * @memberof miden.node.v1
                 * @interface IPaginationInfo
                 * @property {number|null} [chainTip] PaginationInfo chainTip
                 * @property {number|null} [blockNum] PaginationInfo blockNum
                 */

                /**
                 * Constructs a new PaginationInfo.
                 * @memberof miden.node.v1
                 * @classdesc Represents a PaginationInfo.
                 * @implements IPaginationInfo
                 * @constructor
                 * @param {miden.node.v1.IPaginationInfo=} [properties] Properties to set
                 */
                function PaginationInfo(properties) {
                    if (properties)
                        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                this[keys[i]] = properties[keys[i]];
                }

                /**
                 * PaginationInfo chainTip.
                 * @member {number} chainTip
                 * @memberof miden.node.v1.PaginationInfo
                 * @instance
                 */
                PaginationInfo.prototype.chainTip = 0;

                /**
                 * PaginationInfo blockNum.
                 * @member {number} blockNum
                 * @memberof miden.node.v1.PaginationInfo
                 * @instance
                 */
                PaginationInfo.prototype.blockNum = 0;

                /**
                 * Creates a new PaginationInfo instance using the specified properties.
                 * @function create
                 * @memberof miden.node.v1.PaginationInfo
                 * @static
                 * @param {miden.node.v1.IPaginationInfo=} [properties] Properties to set
                 * @returns {miden.node.v1.PaginationInfo} PaginationInfo instance
                 */
                PaginationInfo.create = function create(properties) {
                    return new PaginationInfo(properties);
                };

                /**
                 * Encodes the specified PaginationInfo message. Does not implicitly {@link miden.node.v1.PaginationInfo.verify|verify} messages.
                 * @function encode
                 * @memberof miden.node.v1.PaginationInfo
                 * @static
                 * @param {miden.node.v1.IPaginationInfo} message PaginationInfo message or plain object to encode
                 * @param {$protobuf.Writer} [writer] Writer to encode to
                 * @returns {$protobuf.Writer} Writer
                 */
                PaginationInfo.encode = function encode(message, writer, q) {
                    if (!writer)
                        writer = $Writer.create();
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    if (message.chainTip != null && Object.hasOwnProperty.call(message, "chainTip"))
                        writer.uint32(/* id 1, wireType 5 =*/13).fixed32(message.chainTip);
                    if (message.blockNum != null && Object.hasOwnProperty.call(message, "blockNum"))
                        writer.uint32(/* id 2, wireType 5 =*/21).fixed32(message.blockNum);
                    return writer;
                };

                /**
                 * Decodes a PaginationInfo message from the specified reader or buffer.
                 * @function decode
                 * @memberof miden.node.v1.PaginationInfo
                 * @static
                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                 * @param {number} [length] Message length if known beforehand
                 * @returns {miden.node.v1.PaginationInfo} PaginationInfo
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                PaginationInfo.decode = function decode(reader, length, error, long) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    if (long === undefined)
                        long = 0;
                    if (long > $Reader.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let end, message;
                    if (length === undefined)
                        end = reader.len;
                    else {
                        end = reader.pos + length;
                        if (end > reader.len)
                            throw RangeError("index out of range");
                        length = reader.len;
                        reader.len = end;
                    }
                    message = new $root.miden.node.v1.PaginationInfo();
                    while (reader.pos < end) {
                        let tag = reader.uint32();
                        if (tag === error)
                            break;
                        switch (tag >>> 3) {
                        case 1: {
                                message.chainTip = reader.fixed32();
                                break;
                            }
                        case 2: {
                                message.blockNum = reader.fixed32();
                                break;
                            }
                        default:
                            reader.skipType(tag & 7, long);
                            break;
                        }
                    }
                    if (length !== undefined) {
                        if (reader.pos !== end)
                            throw RangeError("index out of range");
                        reader.len = length;
                    }
                    return message;
                };

                /**
                 * Creates a PaginationInfo message from a plain object. Also converts values to their respective internal types.
                 * @function fromObject
                 * @memberof miden.node.v1.PaginationInfo
                 * @static
                 * @param {Object.<string,*>} object Plain object
                 * @returns {miden.node.v1.PaginationInfo} PaginationInfo
                 */
                PaginationInfo.fromObject = function fromObject(object, long) {
                    if (object instanceof $root.miden.node.v1.PaginationInfo)
                        return object;
                    if (!$util.isObject(object))
                        throw TypeError(".miden.node.v1.PaginationInfo: object expected");
                    if (long === undefined)
                        long = 0;
                    if (long > $util.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let message = new $root.miden.node.v1.PaginationInfo();
                    if (object.chainTip != null)
                        message.chainTip = object.chainTip >>> 0;
                    if (object.blockNum != null)
                        message.blockNum = object.blockNum >>> 0;
                    return message;
                };

                /**
                 * Creates a plain object from a PaginationInfo message. Also converts values to other types if specified.
                 * @function toObject
                 * @memberof miden.node.v1.PaginationInfo
                 * @static
                 * @param {miden.node.v1.PaginationInfo} message PaginationInfo
                 * @param {$protobuf.IConversionOptions} [options] Conversion options
                 * @returns {Object.<string,*>} Plain object
                 */
                PaginationInfo.toObject = function toObject(message, options, q) {
                    if (!options)
                        options = {};
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    let object = {};
                    if (options.defaults) {
                        object.chainTip = 0;
                        object.blockNum = 0;
                    }
                    if (message.chainTip != null && Object.hasOwnProperty.call(message, "chainTip"))
                        object.chainTip = message.chainTip;
                    if (message.blockNum != null && Object.hasOwnProperty.call(message, "blockNum"))
                        object.blockNum = message.blockNum;
                    return object;
                };

                /**
                 * Converts this PaginationInfo to JSON.
                 * @function toJSON
                 * @memberof miden.node.v1.PaginationInfo
                 * @instance
                 * @returns {Object.<string,*>} JSON object
                 */
                PaginationInfo.prototype.toJSON = function toJSON() {
                    return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                };

                /**
                 * Gets the default type url for PaginationInfo
                 * @function getTypeUrl
                 * @memberof miden.node.v1.PaginationInfo
                 * @static
                 * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns {string} The default type url
                 */
                PaginationInfo.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                    if (typeUrlPrefix === undefined) {
                        typeUrlPrefix = "type.googleapis.com";
                    }
                    return typeUrlPrefix + "/miden.node.v1.PaginationInfo";
                };

                return PaginationInfo;
            })();

            v1.SyncTransactionsRequest = (function() {

                /**
                 * Properties of a SyncTransactionsRequest.
                 * @memberof miden.node.v1
                 * @interface ISyncTransactionsRequest
                 * @property {miden.node.v1.IBlockRange|null} [blockRange] SyncTransactionsRequest blockRange
                 * @property {Array.<account.IAccountId>|null} [accountIds] SyncTransactionsRequest accountIds
                 */

                /**
                 * Constructs a new SyncTransactionsRequest.
                 * @memberof miden.node.v1
                 * @classdesc Represents a SyncTransactionsRequest.
                 * @implements ISyncTransactionsRequest
                 * @constructor
                 * @param {miden.node.v1.ISyncTransactionsRequest=} [properties] Properties to set
                 */
                function SyncTransactionsRequest(properties) {
                    this.accountIds = [];
                    if (properties)
                        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                this[keys[i]] = properties[keys[i]];
                }

                /**
                 * SyncTransactionsRequest blockRange.
                 * @member {miden.node.v1.IBlockRange|null|undefined} blockRange
                 * @memberof miden.node.v1.SyncTransactionsRequest
                 * @instance
                 */
                SyncTransactionsRequest.prototype.blockRange = null;

                /**
                 * SyncTransactionsRequest accountIds.
                 * @member {Array.<account.IAccountId>} accountIds
                 * @memberof miden.node.v1.SyncTransactionsRequest
                 * @instance
                 */
                SyncTransactionsRequest.prototype.accountIds = $util.emptyArray;

                /**
                 * Creates a new SyncTransactionsRequest instance using the specified properties.
                 * @function create
                 * @memberof miden.node.v1.SyncTransactionsRequest
                 * @static
                 * @param {miden.node.v1.ISyncTransactionsRequest=} [properties] Properties to set
                 * @returns {miden.node.v1.SyncTransactionsRequest} SyncTransactionsRequest instance
                 */
                SyncTransactionsRequest.create = function create(properties) {
                    return new SyncTransactionsRequest(properties);
                };

                /**
                 * Encodes the specified SyncTransactionsRequest message. Does not implicitly {@link miden.node.v1.SyncTransactionsRequest.verify|verify} messages.
                 * @function encode
                 * @memberof miden.node.v1.SyncTransactionsRequest
                 * @static
                 * @param {miden.node.v1.ISyncTransactionsRequest} message SyncTransactionsRequest message or plain object to encode
                 * @param {$protobuf.Writer} [writer] Writer to encode to
                 * @returns {$protobuf.Writer} Writer
                 */
                SyncTransactionsRequest.encode = function encode(message, writer, q) {
                    if (!writer)
                        writer = $Writer.create();
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    if (message.blockRange != null && Object.hasOwnProperty.call(message, "blockRange"))
                        $root.miden.node.v1.BlockRange.encode(message.blockRange, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                    if (message.accountIds != null && message.accountIds.length)
                        for (let i = 0; i < message.accountIds.length; ++i)
                            $root.account.AccountId.encode(message.accountIds[i], writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
                    return writer;
                };

                /**
                 * Decodes a SyncTransactionsRequest message from the specified reader or buffer.
                 * @function decode
                 * @memberof miden.node.v1.SyncTransactionsRequest
                 * @static
                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                 * @param {number} [length] Message length if known beforehand
                 * @returns {miden.node.v1.SyncTransactionsRequest} SyncTransactionsRequest
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                SyncTransactionsRequest.decode = function decode(reader, length, error, long) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    if (long === undefined)
                        long = 0;
                    if (long > $Reader.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let end, message;
                    if (length === undefined)
                        end = reader.len;
                    else {
                        end = reader.pos + length;
                        if (end > reader.len)
                            throw RangeError("index out of range");
                        length = reader.len;
                        reader.len = end;
                    }
                    message = new $root.miden.node.v1.SyncTransactionsRequest();
                    while (reader.pos < end) {
                        let tag = reader.uint32();
                        if (tag === error)
                            break;
                        switch (tag >>> 3) {
                        case 1: {
                                message.blockRange = $root.miden.node.v1.BlockRange.decode(reader, reader.uint32(), undefined, long + 1);
                                break;
                            }
                        case 2: {
                                if (!(message.accountIds && message.accountIds.length))
                                    message.accountIds = [];
                                message.accountIds.push($root.account.AccountId.decode(reader, reader.uint32(), undefined, long + 1));
                                break;
                            }
                        default:
                            reader.skipType(tag & 7, long);
                            break;
                        }
                    }
                    if (length !== undefined) {
                        if (reader.pos !== end)
                            throw RangeError("index out of range");
                        reader.len = length;
                    }
                    return message;
                };

                /**
                 * Creates a SyncTransactionsRequest message from a plain object. Also converts values to their respective internal types.
                 * @function fromObject
                 * @memberof miden.node.v1.SyncTransactionsRequest
                 * @static
                 * @param {Object.<string,*>} object Plain object
                 * @returns {miden.node.v1.SyncTransactionsRequest} SyncTransactionsRequest
                 */
                SyncTransactionsRequest.fromObject = function fromObject(object, long) {
                    if (object instanceof $root.miden.node.v1.SyncTransactionsRequest)
                        return object;
                    if (!$util.isObject(object))
                        throw TypeError(".miden.node.v1.SyncTransactionsRequest: object expected");
                    if (long === undefined)
                        long = 0;
                    if (long > $util.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let message = new $root.miden.node.v1.SyncTransactionsRequest();
                    if (object.blockRange != null) {
                        if (!$util.isObject(object.blockRange))
                            throw TypeError(".miden.node.v1.SyncTransactionsRequest.blockRange: object expected");
                        message.blockRange = $root.miden.node.v1.BlockRange.fromObject(object.blockRange, long + 1);
                    }
                    if (object.accountIds) {
                        if (!Array.isArray(object.accountIds))
                            throw TypeError(".miden.node.v1.SyncTransactionsRequest.accountIds: array expected");
                        message.accountIds = [];
                        for (let i = 0; i < object.accountIds.length; ++i) {
                            if (!$util.isObject(object.accountIds[i]))
                                throw TypeError(".miden.node.v1.SyncTransactionsRequest.accountIds: object expected");
                            message.accountIds[i] = $root.account.AccountId.fromObject(object.accountIds[i], long + 1);
                        }
                    }
                    return message;
                };

                /**
                 * Creates a plain object from a SyncTransactionsRequest message. Also converts values to other types if specified.
                 * @function toObject
                 * @memberof miden.node.v1.SyncTransactionsRequest
                 * @static
                 * @param {miden.node.v1.SyncTransactionsRequest} message SyncTransactionsRequest
                 * @param {$protobuf.IConversionOptions} [options] Conversion options
                 * @returns {Object.<string,*>} Plain object
                 */
                SyncTransactionsRequest.toObject = function toObject(message, options, q) {
                    if (!options)
                        options = {};
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    let object = {};
                    if (options.arrays || options.defaults)
                        object.accountIds = [];
                    if (options.defaults)
                        object.blockRange = null;
                    if (message.blockRange != null && Object.hasOwnProperty.call(message, "blockRange"))
                        object.blockRange = $root.miden.node.v1.BlockRange.toObject(message.blockRange, options, q + 1);
                    if (message.accountIds && message.accountIds.length) {
                        object.accountIds = [];
                        for (let j = 0; j < message.accountIds.length; ++j)
                            object.accountIds[j] = $root.account.AccountId.toObject(message.accountIds[j], options, q + 1);
                    }
                    return object;
                };

                /**
                 * Converts this SyncTransactionsRequest to JSON.
                 * @function toJSON
                 * @memberof miden.node.v1.SyncTransactionsRequest
                 * @instance
                 * @returns {Object.<string,*>} JSON object
                 */
                SyncTransactionsRequest.prototype.toJSON = function toJSON() {
                    return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                };

                /**
                 * Gets the default type url for SyncTransactionsRequest
                 * @function getTypeUrl
                 * @memberof miden.node.v1.SyncTransactionsRequest
                 * @static
                 * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns {string} The default type url
                 */
                SyncTransactionsRequest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                    if (typeUrlPrefix === undefined) {
                        typeUrlPrefix = "type.googleapis.com";
                    }
                    return typeUrlPrefix + "/miden.node.v1.SyncTransactionsRequest";
                };

                return SyncTransactionsRequest;
            })();

            v1.SyncTransactionsResponse = (function() {

                /**
                 * Properties of a SyncTransactionsResponse.
                 * @memberof miden.node.v1
                 * @interface ISyncTransactionsResponse
                 * @property {miden.node.v1.IPaginationInfo|null} [paginationInfo] SyncTransactionsResponse paginationInfo
                 * @property {Array.<miden.node.v1.ITransactionRecord>|null} [transactions] SyncTransactionsResponse transactions
                 */

                /**
                 * Constructs a new SyncTransactionsResponse.
                 * @memberof miden.node.v1
                 * @classdesc Represents a SyncTransactionsResponse.
                 * @implements ISyncTransactionsResponse
                 * @constructor
                 * @param {miden.node.v1.ISyncTransactionsResponse=} [properties] Properties to set
                 */
                function SyncTransactionsResponse(properties) {
                    this.transactions = [];
                    if (properties)
                        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                this[keys[i]] = properties[keys[i]];
                }

                /**
                 * SyncTransactionsResponse paginationInfo.
                 * @member {miden.node.v1.IPaginationInfo|null|undefined} paginationInfo
                 * @memberof miden.node.v1.SyncTransactionsResponse
                 * @instance
                 */
                SyncTransactionsResponse.prototype.paginationInfo = null;

                /**
                 * SyncTransactionsResponse transactions.
                 * @member {Array.<miden.node.v1.ITransactionRecord>} transactions
                 * @memberof miden.node.v1.SyncTransactionsResponse
                 * @instance
                 */
                SyncTransactionsResponse.prototype.transactions = $util.emptyArray;

                /**
                 * Creates a new SyncTransactionsResponse instance using the specified properties.
                 * @function create
                 * @memberof miden.node.v1.SyncTransactionsResponse
                 * @static
                 * @param {miden.node.v1.ISyncTransactionsResponse=} [properties] Properties to set
                 * @returns {miden.node.v1.SyncTransactionsResponse} SyncTransactionsResponse instance
                 */
                SyncTransactionsResponse.create = function create(properties) {
                    return new SyncTransactionsResponse(properties);
                };

                /**
                 * Encodes the specified SyncTransactionsResponse message. Does not implicitly {@link miden.node.v1.SyncTransactionsResponse.verify|verify} messages.
                 * @function encode
                 * @memberof miden.node.v1.SyncTransactionsResponse
                 * @static
                 * @param {miden.node.v1.ISyncTransactionsResponse} message SyncTransactionsResponse message or plain object to encode
                 * @param {$protobuf.Writer} [writer] Writer to encode to
                 * @returns {$protobuf.Writer} Writer
                 */
                SyncTransactionsResponse.encode = function encode(message, writer, q) {
                    if (!writer)
                        writer = $Writer.create();
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    if (message.paginationInfo != null && Object.hasOwnProperty.call(message, "paginationInfo"))
                        $root.miden.node.v1.PaginationInfo.encode(message.paginationInfo, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                    if (message.transactions != null && message.transactions.length)
                        for (let i = 0; i < message.transactions.length; ++i)
                            $root.miden.node.v1.TransactionRecord.encode(message.transactions[i], writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
                    return writer;
                };

                /**
                 * Decodes a SyncTransactionsResponse message from the specified reader or buffer.
                 * @function decode
                 * @memberof miden.node.v1.SyncTransactionsResponse
                 * @static
                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                 * @param {number} [length] Message length if known beforehand
                 * @returns {miden.node.v1.SyncTransactionsResponse} SyncTransactionsResponse
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                SyncTransactionsResponse.decode = function decode(reader, length, error, long) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    if (long === undefined)
                        long = 0;
                    if (long > $Reader.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let end, message;
                    if (length === undefined)
                        end = reader.len;
                    else {
                        end = reader.pos + length;
                        if (end > reader.len)
                            throw RangeError("index out of range");
                        length = reader.len;
                        reader.len = end;
                    }
                    message = new $root.miden.node.v1.SyncTransactionsResponse();
                    while (reader.pos < end) {
                        let tag = reader.uint32();
                        if (tag === error)
                            break;
                        switch (tag >>> 3) {
                        case 1: {
                                message.paginationInfo = $root.miden.node.v1.PaginationInfo.decode(reader, reader.uint32(), undefined, long + 1);
                                break;
                            }
                        case 2: {
                                if (!(message.transactions && message.transactions.length))
                                    message.transactions = [];
                                message.transactions.push($root.miden.node.v1.TransactionRecord.decode(reader, reader.uint32(), undefined, long + 1));
                                break;
                            }
                        default:
                            reader.skipType(tag & 7, long);
                            break;
                        }
                    }
                    if (length !== undefined) {
                        if (reader.pos !== end)
                            throw RangeError("index out of range");
                        reader.len = length;
                    }
                    return message;
                };

                /**
                 * Creates a SyncTransactionsResponse message from a plain object. Also converts values to their respective internal types.
                 * @function fromObject
                 * @memberof miden.node.v1.SyncTransactionsResponse
                 * @static
                 * @param {Object.<string,*>} object Plain object
                 * @returns {miden.node.v1.SyncTransactionsResponse} SyncTransactionsResponse
                 */
                SyncTransactionsResponse.fromObject = function fromObject(object, long) {
                    if (object instanceof $root.miden.node.v1.SyncTransactionsResponse)
                        return object;
                    if (!$util.isObject(object))
                        throw TypeError(".miden.node.v1.SyncTransactionsResponse: object expected");
                    if (long === undefined)
                        long = 0;
                    if (long > $util.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let message = new $root.miden.node.v1.SyncTransactionsResponse();
                    if (object.paginationInfo != null) {
                        if (!$util.isObject(object.paginationInfo))
                            throw TypeError(".miden.node.v1.SyncTransactionsResponse.paginationInfo: object expected");
                        message.paginationInfo = $root.miden.node.v1.PaginationInfo.fromObject(object.paginationInfo, long + 1);
                    }
                    if (object.transactions) {
                        if (!Array.isArray(object.transactions))
                            throw TypeError(".miden.node.v1.SyncTransactionsResponse.transactions: array expected");
                        message.transactions = [];
                        for (let i = 0; i < object.transactions.length; ++i) {
                            if (!$util.isObject(object.transactions[i]))
                                throw TypeError(".miden.node.v1.SyncTransactionsResponse.transactions: object expected");
                            message.transactions[i] = $root.miden.node.v1.TransactionRecord.fromObject(object.transactions[i], long + 1);
                        }
                    }
                    return message;
                };

                /**
                 * Creates a plain object from a SyncTransactionsResponse message. Also converts values to other types if specified.
                 * @function toObject
                 * @memberof miden.node.v1.SyncTransactionsResponse
                 * @static
                 * @param {miden.node.v1.SyncTransactionsResponse} message SyncTransactionsResponse
                 * @param {$protobuf.IConversionOptions} [options] Conversion options
                 * @returns {Object.<string,*>} Plain object
                 */
                SyncTransactionsResponse.toObject = function toObject(message, options, q) {
                    if (!options)
                        options = {};
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    let object = {};
                    if (options.arrays || options.defaults)
                        object.transactions = [];
                    if (options.defaults)
                        object.paginationInfo = null;
                    if (message.paginationInfo != null && Object.hasOwnProperty.call(message, "paginationInfo"))
                        object.paginationInfo = $root.miden.node.v1.PaginationInfo.toObject(message.paginationInfo, options, q + 1);
                    if (message.transactions && message.transactions.length) {
                        object.transactions = [];
                        for (let j = 0; j < message.transactions.length; ++j)
                            object.transactions[j] = $root.miden.node.v1.TransactionRecord.toObject(message.transactions[j], options, q + 1);
                    }
                    return object;
                };

                /**
                 * Converts this SyncTransactionsResponse to JSON.
                 * @function toJSON
                 * @memberof miden.node.v1.SyncTransactionsResponse
                 * @instance
                 * @returns {Object.<string,*>} JSON object
                 */
                SyncTransactionsResponse.prototype.toJSON = function toJSON() {
                    return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                };

                /**
                 * Gets the default type url for SyncTransactionsResponse
                 * @function getTypeUrl
                 * @memberof miden.node.v1.SyncTransactionsResponse
                 * @static
                 * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns {string} The default type url
                 */
                SyncTransactionsResponse.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                    if (typeUrlPrefix === undefined) {
                        typeUrlPrefix = "type.googleapis.com";
                    }
                    return typeUrlPrefix + "/miden.node.v1.SyncTransactionsResponse";
                };

                return SyncTransactionsResponse;
            })();

            v1.TransactionRecord = (function() {

                /**
                 * Properties of a TransactionRecord.
                 * @memberof miden.node.v1
                 * @interface ITransactionRecord
                 * @property {number|null} [blockNum] TransactionRecord blockNum
                 * @property {transaction.ITransactionHeader|null} [header] TransactionRecord header
                 * @property {Array.<note.INoteInclusionProof>|null} [outputNoteProofs] TransactionRecord outputNoteProofs
                 * @property {Array.<miden.node.v1.IConsumedNoteRef>|null} [consumedNoteRefs] TransactionRecord consumedNoteRefs
                 */

                /**
                 * Constructs a new TransactionRecord.
                 * @memberof miden.node.v1
                 * @classdesc Represents a TransactionRecord.
                 * @implements ITransactionRecord
                 * @constructor
                 * @param {miden.node.v1.ITransactionRecord=} [properties] Properties to set
                 */
                function TransactionRecord(properties) {
                    this.outputNoteProofs = [];
                    this.consumedNoteRefs = [];
                    if (properties)
                        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                this[keys[i]] = properties[keys[i]];
                }

                /**
                 * TransactionRecord blockNum.
                 * @member {number} blockNum
                 * @memberof miden.node.v1.TransactionRecord
                 * @instance
                 */
                TransactionRecord.prototype.blockNum = 0;

                /**
                 * TransactionRecord header.
                 * @member {transaction.ITransactionHeader|null|undefined} header
                 * @memberof miden.node.v1.TransactionRecord
                 * @instance
                 */
                TransactionRecord.prototype.header = null;

                /**
                 * TransactionRecord outputNoteProofs.
                 * @member {Array.<note.INoteInclusionProof>} outputNoteProofs
                 * @memberof miden.node.v1.TransactionRecord
                 * @instance
                 */
                TransactionRecord.prototype.outputNoteProofs = $util.emptyArray;

                /**
                 * TransactionRecord consumedNoteRefs.
                 * @member {Array.<miden.node.v1.IConsumedNoteRef>} consumedNoteRefs
                 * @memberof miden.node.v1.TransactionRecord
                 * @instance
                 */
                TransactionRecord.prototype.consumedNoteRefs = $util.emptyArray;

                /**
                 * Creates a new TransactionRecord instance using the specified properties.
                 * @function create
                 * @memberof miden.node.v1.TransactionRecord
                 * @static
                 * @param {miden.node.v1.ITransactionRecord=} [properties] Properties to set
                 * @returns {miden.node.v1.TransactionRecord} TransactionRecord instance
                 */
                TransactionRecord.create = function create(properties) {
                    return new TransactionRecord(properties);
                };

                /**
                 * Encodes the specified TransactionRecord message. Does not implicitly {@link miden.node.v1.TransactionRecord.verify|verify} messages.
                 * @function encode
                 * @memberof miden.node.v1.TransactionRecord
                 * @static
                 * @param {miden.node.v1.ITransactionRecord} message TransactionRecord message or plain object to encode
                 * @param {$protobuf.Writer} [writer] Writer to encode to
                 * @returns {$protobuf.Writer} Writer
                 */
                TransactionRecord.encode = function encode(message, writer, q) {
                    if (!writer)
                        writer = $Writer.create();
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    if (message.blockNum != null && Object.hasOwnProperty.call(message, "blockNum"))
                        writer.uint32(/* id 1, wireType 5 =*/13).fixed32(message.blockNum);
                    if (message.header != null && Object.hasOwnProperty.call(message, "header"))
                        $root.transaction.TransactionHeader.encode(message.header, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
                    if (message.outputNoteProofs != null && message.outputNoteProofs.length)
                        for (let i = 0; i < message.outputNoteProofs.length; ++i)
                            $root.note.NoteInclusionProof.encode(message.outputNoteProofs[i], writer.uint32(/* id 3, wireType 2 =*/26).fork(), q + 1).ldelim();
                    if (message.consumedNoteRefs != null && message.consumedNoteRefs.length)
                        for (let i = 0; i < message.consumedNoteRefs.length; ++i)
                            $root.miden.node.v1.ConsumedNoteRef.encode(message.consumedNoteRefs[i], writer.uint32(/* id 4, wireType 2 =*/34).fork(), q + 1).ldelim();
                    return writer;
                };

                /**
                 * Decodes a TransactionRecord message from the specified reader or buffer.
                 * @function decode
                 * @memberof miden.node.v1.TransactionRecord
                 * @static
                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                 * @param {number} [length] Message length if known beforehand
                 * @returns {miden.node.v1.TransactionRecord} TransactionRecord
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                TransactionRecord.decode = function decode(reader, length, error, long) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    if (long === undefined)
                        long = 0;
                    if (long > $Reader.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let end, message;
                    if (length === undefined)
                        end = reader.len;
                    else {
                        end = reader.pos + length;
                        if (end > reader.len)
                            throw RangeError("index out of range");
                        length = reader.len;
                        reader.len = end;
                    }
                    message = new $root.miden.node.v1.TransactionRecord();
                    while (reader.pos < end) {
                        let tag = reader.uint32();
                        if (tag === error)
                            break;
                        switch (tag >>> 3) {
                        case 1: {
                                message.blockNum = reader.fixed32();
                                break;
                            }
                        case 2: {
                                message.header = $root.transaction.TransactionHeader.decode(reader, reader.uint32(), undefined, long + 1);
                                break;
                            }
                        case 3: {
                                if (!(message.outputNoteProofs && message.outputNoteProofs.length))
                                    message.outputNoteProofs = [];
                                message.outputNoteProofs.push($root.note.NoteInclusionProof.decode(reader, reader.uint32(), undefined, long + 1));
                                break;
                            }
                        case 4: {
                                if (!(message.consumedNoteRefs && message.consumedNoteRefs.length))
                                    message.consumedNoteRefs = [];
                                message.consumedNoteRefs.push($root.miden.node.v1.ConsumedNoteRef.decode(reader, reader.uint32(), undefined, long + 1));
                                break;
                            }
                        default:
                            reader.skipType(tag & 7, long);
                            break;
                        }
                    }
                    if (length !== undefined) {
                        if (reader.pos !== end)
                            throw RangeError("index out of range");
                        reader.len = length;
                    }
                    return message;
                };

                /**
                 * Creates a TransactionRecord message from a plain object. Also converts values to their respective internal types.
                 * @function fromObject
                 * @memberof miden.node.v1.TransactionRecord
                 * @static
                 * @param {Object.<string,*>} object Plain object
                 * @returns {miden.node.v1.TransactionRecord} TransactionRecord
                 */
                TransactionRecord.fromObject = function fromObject(object, long) {
                    if (object instanceof $root.miden.node.v1.TransactionRecord)
                        return object;
                    if (!$util.isObject(object))
                        throw TypeError(".miden.node.v1.TransactionRecord: object expected");
                    if (long === undefined)
                        long = 0;
                    if (long > $util.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let message = new $root.miden.node.v1.TransactionRecord();
                    if (object.blockNum != null)
                        message.blockNum = object.blockNum >>> 0;
                    if (object.header != null) {
                        if (!$util.isObject(object.header))
                            throw TypeError(".miden.node.v1.TransactionRecord.header: object expected");
                        message.header = $root.transaction.TransactionHeader.fromObject(object.header, long + 1);
                    }
                    if (object.outputNoteProofs) {
                        if (!Array.isArray(object.outputNoteProofs))
                            throw TypeError(".miden.node.v1.TransactionRecord.outputNoteProofs: array expected");
                        message.outputNoteProofs = [];
                        for (let i = 0; i < object.outputNoteProofs.length; ++i) {
                            if (!$util.isObject(object.outputNoteProofs[i]))
                                throw TypeError(".miden.node.v1.TransactionRecord.outputNoteProofs: object expected");
                            message.outputNoteProofs[i] = $root.note.NoteInclusionProof.fromObject(object.outputNoteProofs[i], long + 1);
                        }
                    }
                    if (object.consumedNoteRefs) {
                        if (!Array.isArray(object.consumedNoteRefs))
                            throw TypeError(".miden.node.v1.TransactionRecord.consumedNoteRefs: array expected");
                        message.consumedNoteRefs = [];
                        for (let i = 0; i < object.consumedNoteRefs.length; ++i) {
                            if (!$util.isObject(object.consumedNoteRefs[i]))
                                throw TypeError(".miden.node.v1.TransactionRecord.consumedNoteRefs: object expected");
                            message.consumedNoteRefs[i] = $root.miden.node.v1.ConsumedNoteRef.fromObject(object.consumedNoteRefs[i], long + 1);
                        }
                    }
                    return message;
                };

                /**
                 * Creates a plain object from a TransactionRecord message. Also converts values to other types if specified.
                 * @function toObject
                 * @memberof miden.node.v1.TransactionRecord
                 * @static
                 * @param {miden.node.v1.TransactionRecord} message TransactionRecord
                 * @param {$protobuf.IConversionOptions} [options] Conversion options
                 * @returns {Object.<string,*>} Plain object
                 */
                TransactionRecord.toObject = function toObject(message, options, q) {
                    if (!options)
                        options = {};
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    let object = {};
                    if (options.arrays || options.defaults) {
                        object.outputNoteProofs = [];
                        object.consumedNoteRefs = [];
                    }
                    if (options.defaults) {
                        object.blockNum = 0;
                        object.header = null;
                    }
                    if (message.blockNum != null && Object.hasOwnProperty.call(message, "blockNum"))
                        object.blockNum = message.blockNum;
                    if (message.header != null && Object.hasOwnProperty.call(message, "header"))
                        object.header = $root.transaction.TransactionHeader.toObject(message.header, options, q + 1);
                    if (message.outputNoteProofs && message.outputNoteProofs.length) {
                        object.outputNoteProofs = [];
                        for (let j = 0; j < message.outputNoteProofs.length; ++j)
                            object.outputNoteProofs[j] = $root.note.NoteInclusionProof.toObject(message.outputNoteProofs[j], options, q + 1);
                    }
                    if (message.consumedNoteRefs && message.consumedNoteRefs.length) {
                        object.consumedNoteRefs = [];
                        for (let j = 0; j < message.consumedNoteRefs.length; ++j)
                            object.consumedNoteRefs[j] = $root.miden.node.v1.ConsumedNoteRef.toObject(message.consumedNoteRefs[j], options, q + 1);
                    }
                    return object;
                };

                /**
                 * Converts this TransactionRecord to JSON.
                 * @function toJSON
                 * @memberof miden.node.v1.TransactionRecord
                 * @instance
                 * @returns {Object.<string,*>} JSON object
                 */
                TransactionRecord.prototype.toJSON = function toJSON() {
                    return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                };

                /**
                 * Gets the default type url for TransactionRecord
                 * @function getTypeUrl
                 * @memberof miden.node.v1.TransactionRecord
                 * @static
                 * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns {string} The default type url
                 */
                TransactionRecord.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                    if (typeUrlPrefix === undefined) {
                        typeUrlPrefix = "type.googleapis.com";
                    }
                    return typeUrlPrefix + "/miden.node.v1.TransactionRecord";
                };

                return TransactionRecord;
            })();

            v1.ConsumedNoteRef = (function() {

                /**
                 * Properties of a ConsumedNoteRef.
                 * @memberof miden.node.v1
                 * @interface IConsumedNoteRef
                 * @property {primitives.IWord|null} [nullifier] ConsumedNoteRef nullifier
                 * @property {note.INoteId|null} [noteId] ConsumedNoteRef noteId
                 */

                /**
                 * Constructs a new ConsumedNoteRef.
                 * @memberof miden.node.v1
                 * @classdesc Represents a ConsumedNoteRef.
                 * @implements IConsumedNoteRef
                 * @constructor
                 * @param {miden.node.v1.IConsumedNoteRef=} [properties] Properties to set
                 */
                function ConsumedNoteRef(properties) {
                    if (properties)
                        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                this[keys[i]] = properties[keys[i]];
                }

                /**
                 * ConsumedNoteRef nullifier.
                 * @member {primitives.IWord|null|undefined} nullifier
                 * @memberof miden.node.v1.ConsumedNoteRef
                 * @instance
                 */
                ConsumedNoteRef.prototype.nullifier = null;

                /**
                 * ConsumedNoteRef noteId.
                 * @member {note.INoteId|null|undefined} noteId
                 * @memberof miden.node.v1.ConsumedNoteRef
                 * @instance
                 */
                ConsumedNoteRef.prototype.noteId = null;

                /**
                 * Creates a new ConsumedNoteRef instance using the specified properties.
                 * @function create
                 * @memberof miden.node.v1.ConsumedNoteRef
                 * @static
                 * @param {miden.node.v1.IConsumedNoteRef=} [properties] Properties to set
                 * @returns {miden.node.v1.ConsumedNoteRef} ConsumedNoteRef instance
                 */
                ConsumedNoteRef.create = function create(properties) {
                    return new ConsumedNoteRef(properties);
                };

                /**
                 * Encodes the specified ConsumedNoteRef message. Does not implicitly {@link miden.node.v1.ConsumedNoteRef.verify|verify} messages.
                 * @function encode
                 * @memberof miden.node.v1.ConsumedNoteRef
                 * @static
                 * @param {miden.node.v1.IConsumedNoteRef} message ConsumedNoteRef message or plain object to encode
                 * @param {$protobuf.Writer} [writer] Writer to encode to
                 * @returns {$protobuf.Writer} Writer
                 */
                ConsumedNoteRef.encode = function encode(message, writer, q) {
                    if (!writer)
                        writer = $Writer.create();
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    if (message.nullifier != null && Object.hasOwnProperty.call(message, "nullifier"))
                        $root.primitives.Word.encode(message.nullifier, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
                    if (message.noteId != null && Object.hasOwnProperty.call(message, "noteId"))
                        $root.note.NoteId.encode(message.noteId, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
                    return writer;
                };

                /**
                 * Decodes a ConsumedNoteRef message from the specified reader or buffer.
                 * @function decode
                 * @memberof miden.node.v1.ConsumedNoteRef
                 * @static
                 * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                 * @param {number} [length] Message length if known beforehand
                 * @returns {miden.node.v1.ConsumedNoteRef} ConsumedNoteRef
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                ConsumedNoteRef.decode = function decode(reader, length, error, long) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    if (long === undefined)
                        long = 0;
                    if (long > $Reader.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let end, message;
                    if (length === undefined)
                        end = reader.len;
                    else {
                        end = reader.pos + length;
                        if (end > reader.len)
                            throw RangeError("index out of range");
                        length = reader.len;
                        reader.len = end;
                    }
                    message = new $root.miden.node.v1.ConsumedNoteRef();
                    while (reader.pos < end) {
                        let tag = reader.uint32();
                        if (tag === error)
                            break;
                        switch (tag >>> 3) {
                        case 1: {
                                message.nullifier = $root.primitives.Word.decode(reader, reader.uint32(), undefined, long + 1);
                                break;
                            }
                        case 2: {
                                message.noteId = $root.note.NoteId.decode(reader, reader.uint32(), undefined, long + 1);
                                break;
                            }
                        default:
                            reader.skipType(tag & 7, long);
                            break;
                        }
                    }
                    if (length !== undefined) {
                        if (reader.pos !== end)
                            throw RangeError("index out of range");
                        reader.len = length;
                    }
                    return message;
                };

                /**
                 * Creates a ConsumedNoteRef message from a plain object. Also converts values to their respective internal types.
                 * @function fromObject
                 * @memberof miden.node.v1.ConsumedNoteRef
                 * @static
                 * @param {Object.<string,*>} object Plain object
                 * @returns {miden.node.v1.ConsumedNoteRef} ConsumedNoteRef
                 */
                ConsumedNoteRef.fromObject = function fromObject(object, long) {
                    if (object instanceof $root.miden.node.v1.ConsumedNoteRef)
                        return object;
                    if (!$util.isObject(object))
                        throw TypeError(".miden.node.v1.ConsumedNoteRef: object expected");
                    if (long === undefined)
                        long = 0;
                    if (long > $util.recursionLimit)
                        throw Error("maximum nesting depth exceeded");
                    let message = new $root.miden.node.v1.ConsumedNoteRef();
                    if (object.nullifier != null) {
                        if (!$util.isObject(object.nullifier))
                            throw TypeError(".miden.node.v1.ConsumedNoteRef.nullifier: object expected");
                        message.nullifier = $root.primitives.Word.fromObject(object.nullifier, long + 1);
                    }
                    if (object.noteId != null) {
                        if (!$util.isObject(object.noteId))
                            throw TypeError(".miden.node.v1.ConsumedNoteRef.noteId: object expected");
                        message.noteId = $root.note.NoteId.fromObject(object.noteId, long + 1);
                    }
                    return message;
                };

                /**
                 * Creates a plain object from a ConsumedNoteRef message. Also converts values to other types if specified.
                 * @function toObject
                 * @memberof miden.node.v1.ConsumedNoteRef
                 * @static
                 * @param {miden.node.v1.ConsumedNoteRef} message ConsumedNoteRef
                 * @param {$protobuf.IConversionOptions} [options] Conversion options
                 * @returns {Object.<string,*>} Plain object
                 */
                ConsumedNoteRef.toObject = function toObject(message, options, q) {
                    if (!options)
                        options = {};
                    if (q === undefined)
                        q = 0;
                    if (q > $util.recursionLimit)
                        throw Error("max depth exceeded");
                    let object = {};
                    if (options.defaults) {
                        object.nullifier = null;
                        object.noteId = null;
                    }
                    if (message.nullifier != null && Object.hasOwnProperty.call(message, "nullifier"))
                        object.nullifier = $root.primitives.Word.toObject(message.nullifier, options, q + 1);
                    if (message.noteId != null && Object.hasOwnProperty.call(message, "noteId"))
                        object.noteId = $root.note.NoteId.toObject(message.noteId, options, q + 1);
                    return object;
                };

                /**
                 * Converts this ConsumedNoteRef to JSON.
                 * @function toJSON
                 * @memberof miden.node.v1.ConsumedNoteRef
                 * @instance
                 * @returns {Object.<string,*>} JSON object
                 */
                ConsumedNoteRef.prototype.toJSON = function toJSON() {
                    return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                };

                /**
                 * Gets the default type url for ConsumedNoteRef
                 * @function getTypeUrl
                 * @memberof miden.node.v1.ConsumedNoteRef
                 * @static
                 * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns {string} The default type url
                 */
                ConsumedNoteRef.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                    if (typeUrlPrefix === undefined) {
                        typeUrlPrefix = "type.googleapis.com";
                    }
                    return typeUrlPrefix + "/miden.node.v1.ConsumedNoteRef";
                };

                return ConsumedNoteRef;
            })();

            return v1;
        })();

        return node;
    })();

    return miden;
})();

export const account = $root.account = (() => {

    /**
     * Namespace account.
     * @exports account
     * @namespace
     */
    const account = {};

    account.AccountId = (function() {

        /**
         * Properties of an AccountId.
         * @memberof account
         * @interface IAccountId
         * @property {account.IAccountIdV1|null} [v1] AccountId v1
         */

        /**
         * Constructs a new AccountId.
         * @memberof account
         * @classdesc Represents an AccountId.
         * @implements IAccountId
         * @constructor
         * @param {account.IAccountId=} [properties] Properties to set
         */
        function AccountId(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * AccountId v1.
         * @member {account.IAccountIdV1|null|undefined} v1
         * @memberof account.AccountId
         * @instance
         */
        AccountId.prototype.v1 = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        /**
         * AccountId version.
         * @member {"v1"|undefined} version
         * @memberof account.AccountId
         * @instance
         */
        Object.defineProperty(AccountId.prototype, "version", {
            get: $util.oneOfGetter($oneOfFields = ["v1"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new AccountId instance using the specified properties.
         * @function create
         * @memberof account.AccountId
         * @static
         * @param {account.IAccountId=} [properties] Properties to set
         * @returns {account.AccountId} AccountId instance
         */
        AccountId.create = function create(properties) {
            return new AccountId(properties);
        };

        /**
         * Encodes the specified AccountId message. Does not implicitly {@link account.AccountId.verify|verify} messages.
         * @function encode
         * @memberof account.AccountId
         * @static
         * @param {account.IAccountId} message AccountId message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        AccountId.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.v1 != null && Object.hasOwnProperty.call(message, "v1"))
                $root.account.AccountIdV1.encode(message.v1, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
            return writer;
        };

        /**
         * Decodes an AccountId message from the specified reader or buffer.
         * @function decode
         * @memberof account.AccountId
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {account.AccountId} AccountId
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        AccountId.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.account.AccountId();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.v1 = $root.account.AccountIdV1.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Creates an AccountId message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof account.AccountId
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {account.AccountId} AccountId
         */
        AccountId.fromObject = function fromObject(object, long) {
            if (object instanceof $root.account.AccountId)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".account.AccountId: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.account.AccountId();
            if (object.v1 != null) {
                if (!$util.isObject(object.v1))
                    throw TypeError(".account.AccountId.v1: object expected");
                message.v1 = $root.account.AccountIdV1.fromObject(object.v1, long + 1);
            }
            return message;
        };

        /**
         * Creates a plain object from an AccountId message. Also converts values to other types if specified.
         * @function toObject
         * @memberof account.AccountId
         * @static
         * @param {account.AccountId} message AccountId
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        AccountId.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (message.v1 != null && Object.hasOwnProperty.call(message, "v1")) {
                object.v1 = $root.account.AccountIdV1.toObject(message.v1, options, q + 1);
                if (options.oneofs)
                    object.version = "v1";
            }
            return object;
        };

        /**
         * Converts this AccountId to JSON.
         * @function toJSON
         * @memberof account.AccountId
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        AccountId.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for AccountId
         * @function getTypeUrl
         * @memberof account.AccountId
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        AccountId.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/account.AccountId";
        };

        return AccountId;
    })();

    account.AccountIdV1 = (function() {

        /**
         * Properties of an AccountIdV1.
         * @memberof account
         * @interface IAccountIdV1
         * @property {primitives.IFelt|null} [suffix] AccountIdV1 suffix
         * @property {primitives.IFelt|null} [prefix] AccountIdV1 prefix
         */

        /**
         * Constructs a new AccountIdV1.
         * @memberof account
         * @classdesc Represents an AccountIdV1.
         * @implements IAccountIdV1
         * @constructor
         * @param {account.IAccountIdV1=} [properties] Properties to set
         */
        function AccountIdV1(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * AccountIdV1 suffix.
         * @member {primitives.IFelt|null|undefined} suffix
         * @memberof account.AccountIdV1
         * @instance
         */
        AccountIdV1.prototype.suffix = null;

        /**
         * AccountIdV1 prefix.
         * @member {primitives.IFelt|null|undefined} prefix
         * @memberof account.AccountIdV1
         * @instance
         */
        AccountIdV1.prototype.prefix = null;

        /**
         * Creates a new AccountIdV1 instance using the specified properties.
         * @function create
         * @memberof account.AccountIdV1
         * @static
         * @param {account.IAccountIdV1=} [properties] Properties to set
         * @returns {account.AccountIdV1} AccountIdV1 instance
         */
        AccountIdV1.create = function create(properties) {
            return new AccountIdV1(properties);
        };

        /**
         * Encodes the specified AccountIdV1 message. Does not implicitly {@link account.AccountIdV1.verify|verify} messages.
         * @function encode
         * @memberof account.AccountIdV1
         * @static
         * @param {account.IAccountIdV1} message AccountIdV1 message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        AccountIdV1.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.suffix != null && Object.hasOwnProperty.call(message, "suffix"))
                $root.primitives.Felt.encode(message.suffix, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
            if (message.prefix != null && Object.hasOwnProperty.call(message, "prefix"))
                $root.primitives.Felt.encode(message.prefix, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
            return writer;
        };

        /**
         * Decodes an AccountIdV1 message from the specified reader or buffer.
         * @function decode
         * @memberof account.AccountIdV1
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {account.AccountIdV1} AccountIdV1
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        AccountIdV1.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.account.AccountIdV1();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.suffix = $root.primitives.Felt.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                case 2: {
                        message.prefix = $root.primitives.Felt.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Creates an AccountIdV1 message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof account.AccountIdV1
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {account.AccountIdV1} AccountIdV1
         */
        AccountIdV1.fromObject = function fromObject(object, long) {
            if (object instanceof $root.account.AccountIdV1)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".account.AccountIdV1: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.account.AccountIdV1();
            if (object.suffix != null) {
                if (!$util.isObject(object.suffix))
                    throw TypeError(".account.AccountIdV1.suffix: object expected");
                message.suffix = $root.primitives.Felt.fromObject(object.suffix, long + 1);
            }
            if (object.prefix != null) {
                if (!$util.isObject(object.prefix))
                    throw TypeError(".account.AccountIdV1.prefix: object expected");
                message.prefix = $root.primitives.Felt.fromObject(object.prefix, long + 1);
            }
            return message;
        };

        /**
         * Creates a plain object from an AccountIdV1 message. Also converts values to other types if specified.
         * @function toObject
         * @memberof account.AccountIdV1
         * @static
         * @param {account.AccountIdV1} message AccountIdV1
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        AccountIdV1.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (options.defaults) {
                object.suffix = null;
                object.prefix = null;
            }
            if (message.suffix != null && Object.hasOwnProperty.call(message, "suffix"))
                object.suffix = $root.primitives.Felt.toObject(message.suffix, options, q + 1);
            if (message.prefix != null && Object.hasOwnProperty.call(message, "prefix"))
                object.prefix = $root.primitives.Felt.toObject(message.prefix, options, q + 1);
            return object;
        };

        /**
         * Converts this AccountIdV1 to JSON.
         * @function toJSON
         * @memberof account.AccountIdV1
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        AccountIdV1.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for AccountIdV1
         * @function getTypeUrl
         * @memberof account.AccountIdV1
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        AccountIdV1.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/account.AccountIdV1";
        };

        return AccountIdV1;
    })();

    return account;
})();

export const primitives = $root.primitives = (() => {

    /**
     * Namespace primitives.
     * @exports primitives
     * @namespace
     */
    const primitives = {};

    primitives.Felt = (function() {

        /**
         * Properties of a Felt.
         * @memberof primitives
         * @interface IFelt
         * @property {number|Long|null} [value] Felt value
         */

        /**
         * Constructs a new Felt.
         * @memberof primitives
         * @classdesc Represents a Felt.
         * @implements IFelt
         * @constructor
         * @param {primitives.IFelt=} [properties] Properties to set
         */
        function Felt(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Felt value.
         * @member {number|Long} value
         * @memberof primitives.Felt
         * @instance
         */
        Felt.prototype.value = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Creates a new Felt instance using the specified properties.
         * @function create
         * @memberof primitives.Felt
         * @static
         * @param {primitives.IFelt=} [properties] Properties to set
         * @returns {primitives.Felt} Felt instance
         */
        Felt.create = function create(properties) {
            return new Felt(properties);
        };

        /**
         * Encodes the specified Felt message. Does not implicitly {@link primitives.Felt.verify|verify} messages.
         * @function encode
         * @memberof primitives.Felt
         * @static
         * @param {primitives.IFelt} message Felt message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Felt.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                writer.uint32(/* id 1, wireType 1 =*/9).fixed64(message.value);
            return writer;
        };

        /**
         * Decodes a Felt message from the specified reader or buffer.
         * @function decode
         * @memberof primitives.Felt
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {primitives.Felt} Felt
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Felt.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.primitives.Felt();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.value = reader.fixed64();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Creates a Felt message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof primitives.Felt
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {primitives.Felt} Felt
         */
        Felt.fromObject = function fromObject(object, long) {
            if (object instanceof $root.primitives.Felt)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".primitives.Felt: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.primitives.Felt();
            if (object.value != null)
                if ($util.Long)
                    message.value = $util.Long.fromValue(object.value, true);
                else if (typeof object.value === "string")
                    message.value = parseInt(object.value, 10);
                else if (typeof object.value === "number")
                    message.value = object.value;
                else if (typeof object.value === "object")
                    message.value = new $util.LongBits(object.value.low >>> 0, object.value.high >>> 0).toNumber(true);
            return message;
        };

        /**
         * Creates a plain object from a Felt message. Also converts values to other types if specified.
         * @function toObject
         * @memberof primitives.Felt
         * @static
         * @param {primitives.Felt} message Felt
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Felt.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (options.defaults)
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.value = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : typeof BigInt !== "undefined" && options.longs === BigInt ? long.toBigInt() : long;
                } else
                    object.value = options.longs === String ? "0" : typeof BigInt !== "undefined" && options.longs === BigInt ? BigInt("0") : 0;
            if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                if (typeof BigInt !== "undefined" && options.longs === BigInt)
                    object.value = typeof message.value === "number" ? BigInt(message.value) : $util.Long.fromBits(message.value.low >>> 0, message.value.high >>> 0, true).toBigInt();
                else if (typeof message.value === "number")
                    object.value = options.longs === String ? String(message.value) : message.value;
                else
                    object.value = options.longs === String ? $util.Long.prototype.toString.call(message.value) : options.longs === Number ? new $util.LongBits(message.value.low >>> 0, message.value.high >>> 0).toNumber(true) : message.value;
            return object;
        };

        /**
         * Converts this Felt to JSON.
         * @function toJSON
         * @memberof primitives.Felt
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Felt.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Felt
         * @function getTypeUrl
         * @memberof primitives.Felt
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Felt.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/primitives.Felt";
        };

        return Felt;
    })();

    primitives.Word = (function() {

        /**
         * Properties of a Word.
         * @memberof primitives
         * @interface IWord
         * @property {Uint8Array|null} [encoded] Word encoded
         */

        /**
         * Constructs a new Word.
         * @memberof primitives
         * @classdesc Represents a Word.
         * @implements IWord
         * @constructor
         * @param {primitives.IWord=} [properties] Properties to set
         */
        function Word(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Word encoded.
         * @member {Uint8Array} encoded
         * @memberof primitives.Word
         * @instance
         */
        Word.prototype.encoded = $util.newBuffer([]);

        /**
         * Creates a new Word instance using the specified properties.
         * @function create
         * @memberof primitives.Word
         * @static
         * @param {primitives.IWord=} [properties] Properties to set
         * @returns {primitives.Word} Word instance
         */
        Word.create = function create(properties) {
            return new Word(properties);
        };

        /**
         * Encodes the specified Word message. Does not implicitly {@link primitives.Word.verify|verify} messages.
         * @function encode
         * @memberof primitives.Word
         * @static
         * @param {primitives.IWord} message Word message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Word.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.encoded != null && Object.hasOwnProperty.call(message, "encoded"))
                writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.encoded);
            return writer;
        };

        /**
         * Decodes a Word message from the specified reader or buffer.
         * @function decode
         * @memberof primitives.Word
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {primitives.Word} Word
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Word.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.primitives.Word();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.encoded = reader.bytes();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Creates a Word message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof primitives.Word
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {primitives.Word} Word
         */
        Word.fromObject = function fromObject(object, long) {
            if (object instanceof $root.primitives.Word)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".primitives.Word: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.primitives.Word();
            if (object.encoded != null)
                if (typeof object.encoded === "string")
                    $util.base64.decode(object.encoded, message.encoded = $util.newBuffer($util.base64.length(object.encoded)), 0);
                else if (object.encoded.length >= 0)
                    message.encoded = object.encoded;
            return message;
        };

        /**
         * Creates a plain object from a Word message. Also converts values to other types if specified.
         * @function toObject
         * @memberof primitives.Word
         * @static
         * @param {primitives.Word} message Word
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Word.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (options.defaults)
                if (options.bytes === String)
                    object.encoded = "";
                else {
                    object.encoded = [];
                    if (options.bytes !== Array)
                        object.encoded = $util.newBuffer(object.encoded);
                }
            if (message.encoded != null && Object.hasOwnProperty.call(message, "encoded"))
                object.encoded = options.bytes === String ? $util.base64.encode(message.encoded, 0, message.encoded.length) : options.bytes === Array ? Array.prototype.slice.call(message.encoded) : message.encoded;
            return object;
        };

        /**
         * Converts this Word to JSON.
         * @function toJSON
         * @memberof primitives.Word
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Word.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Word
         * @function getTypeUrl
         * @memberof primitives.Word
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Word.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/primitives.Word";
        };

        return Word;
    })();

    primitives.SparseMerklePath = (function() {

        /**
         * Properties of a SparseMerklePath.
         * @memberof primitives
         * @interface ISparseMerklePath
         * @property {number|Long|null} [emptyNodesMask] SparseMerklePath emptyNodesMask
         * @property {Array.<primitives.IWord>|null} [siblings] SparseMerklePath siblings
         */

        /**
         * Constructs a new SparseMerklePath.
         * @memberof primitives
         * @classdesc Represents a SparseMerklePath.
         * @implements ISparseMerklePath
         * @constructor
         * @param {primitives.ISparseMerklePath=} [properties] Properties to set
         */
        function SparseMerklePath(properties) {
            this.siblings = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * SparseMerklePath emptyNodesMask.
         * @member {number|Long} emptyNodesMask
         * @memberof primitives.SparseMerklePath
         * @instance
         */
        SparseMerklePath.prototype.emptyNodesMask = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * SparseMerklePath siblings.
         * @member {Array.<primitives.IWord>} siblings
         * @memberof primitives.SparseMerklePath
         * @instance
         */
        SparseMerklePath.prototype.siblings = $util.emptyArray;

        /**
         * Creates a new SparseMerklePath instance using the specified properties.
         * @function create
         * @memberof primitives.SparseMerklePath
         * @static
         * @param {primitives.ISparseMerklePath=} [properties] Properties to set
         * @returns {primitives.SparseMerklePath} SparseMerklePath instance
         */
        SparseMerklePath.create = function create(properties) {
            return new SparseMerklePath(properties);
        };

        /**
         * Encodes the specified SparseMerklePath message. Does not implicitly {@link primitives.SparseMerklePath.verify|verify} messages.
         * @function encode
         * @memberof primitives.SparseMerklePath
         * @static
         * @param {primitives.ISparseMerklePath} message SparseMerklePath message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SparseMerklePath.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.emptyNodesMask != null && Object.hasOwnProperty.call(message, "emptyNodesMask"))
                writer.uint32(/* id 1, wireType 1 =*/9).fixed64(message.emptyNodesMask);
            if (message.siblings != null && message.siblings.length)
                for (let i = 0; i < message.siblings.length; ++i)
                    $root.primitives.Word.encode(message.siblings[i], writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
            return writer;
        };

        /**
         * Decodes a SparseMerklePath message from the specified reader or buffer.
         * @function decode
         * @memberof primitives.SparseMerklePath
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {primitives.SparseMerklePath} SparseMerklePath
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SparseMerklePath.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.primitives.SparseMerklePath();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.emptyNodesMask = reader.fixed64();
                        break;
                    }
                case 2: {
                        if (!(message.siblings && message.siblings.length))
                            message.siblings = [];
                        message.siblings.push($root.primitives.Word.decode(reader, reader.uint32(), undefined, long + 1));
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Creates a SparseMerklePath message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof primitives.SparseMerklePath
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {primitives.SparseMerklePath} SparseMerklePath
         */
        SparseMerklePath.fromObject = function fromObject(object, long) {
            if (object instanceof $root.primitives.SparseMerklePath)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".primitives.SparseMerklePath: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.primitives.SparseMerklePath();
            if (object.emptyNodesMask != null)
                if ($util.Long)
                    message.emptyNodesMask = $util.Long.fromValue(object.emptyNodesMask, true);
                else if (typeof object.emptyNodesMask === "string")
                    message.emptyNodesMask = parseInt(object.emptyNodesMask, 10);
                else if (typeof object.emptyNodesMask === "number")
                    message.emptyNodesMask = object.emptyNodesMask;
                else if (typeof object.emptyNodesMask === "object")
                    message.emptyNodesMask = new $util.LongBits(object.emptyNodesMask.low >>> 0, object.emptyNodesMask.high >>> 0).toNumber(true);
            if (object.siblings) {
                if (!Array.isArray(object.siblings))
                    throw TypeError(".primitives.SparseMerklePath.siblings: array expected");
                message.siblings = [];
                for (let i = 0; i < object.siblings.length; ++i) {
                    if (!$util.isObject(object.siblings[i]))
                        throw TypeError(".primitives.SparseMerklePath.siblings: object expected");
                    message.siblings[i] = $root.primitives.Word.fromObject(object.siblings[i], long + 1);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a SparseMerklePath message. Also converts values to other types if specified.
         * @function toObject
         * @memberof primitives.SparseMerklePath
         * @static
         * @param {primitives.SparseMerklePath} message SparseMerklePath
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        SparseMerklePath.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (options.arrays || options.defaults)
                object.siblings = [];
            if (options.defaults)
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.emptyNodesMask = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : typeof BigInt !== "undefined" && options.longs === BigInt ? long.toBigInt() : long;
                } else
                    object.emptyNodesMask = options.longs === String ? "0" : typeof BigInt !== "undefined" && options.longs === BigInt ? BigInt("0") : 0;
            if (message.emptyNodesMask != null && Object.hasOwnProperty.call(message, "emptyNodesMask"))
                if (typeof BigInt !== "undefined" && options.longs === BigInt)
                    object.emptyNodesMask = typeof message.emptyNodesMask === "number" ? BigInt(message.emptyNodesMask) : $util.Long.fromBits(message.emptyNodesMask.low >>> 0, message.emptyNodesMask.high >>> 0, true).toBigInt();
                else if (typeof message.emptyNodesMask === "number")
                    object.emptyNodesMask = options.longs === String ? String(message.emptyNodesMask) : message.emptyNodesMask;
                else
                    object.emptyNodesMask = options.longs === String ? $util.Long.prototype.toString.call(message.emptyNodesMask) : options.longs === Number ? new $util.LongBits(message.emptyNodesMask.low >>> 0, message.emptyNodesMask.high >>> 0).toNumber(true) : message.emptyNodesMask;
            if (message.siblings && message.siblings.length) {
                object.siblings = [];
                for (let j = 0; j < message.siblings.length; ++j)
                    object.siblings[j] = $root.primitives.Word.toObject(message.siblings[j], options, q + 1);
            }
            return object;
        };

        /**
         * Converts this SparseMerklePath to JSON.
         * @function toJSON
         * @memberof primitives.SparseMerklePath
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        SparseMerklePath.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for SparseMerklePath
         * @function getTypeUrl
         * @memberof primitives.SparseMerklePath
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        SparseMerklePath.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/primitives.SparseMerklePath";
        };

        return SparseMerklePath;
    })();

    return primitives;
})();

export const transaction = $root.transaction = (() => {

    /**
     * Namespace transaction.
     * @exports transaction
     * @namespace
     */
    const transaction = {};

    transaction.TransactionId = (function() {

        /**
         * Properties of a TransactionId.
         * @memberof transaction
         * @interface ITransactionId
         * @property {primitives.IWord|null} [id] TransactionId id
         */

        /**
         * Constructs a new TransactionId.
         * @memberof transaction
         * @classdesc Represents a TransactionId.
         * @implements ITransactionId
         * @constructor
         * @param {transaction.ITransactionId=} [properties] Properties to set
         */
        function TransactionId(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * TransactionId id.
         * @member {primitives.IWord|null|undefined} id
         * @memberof transaction.TransactionId
         * @instance
         */
        TransactionId.prototype.id = null;

        /**
         * Creates a new TransactionId instance using the specified properties.
         * @function create
         * @memberof transaction.TransactionId
         * @static
         * @param {transaction.ITransactionId=} [properties] Properties to set
         * @returns {transaction.TransactionId} TransactionId instance
         */
        TransactionId.create = function create(properties) {
            return new TransactionId(properties);
        };

        /**
         * Encodes the specified TransactionId message. Does not implicitly {@link transaction.TransactionId.verify|verify} messages.
         * @function encode
         * @memberof transaction.TransactionId
         * @static
         * @param {transaction.ITransactionId} message TransactionId message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        TransactionId.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                $root.primitives.Word.encode(message.id, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
            return writer;
        };

        /**
         * Decodes a TransactionId message from the specified reader or buffer.
         * @function decode
         * @memberof transaction.TransactionId
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {transaction.TransactionId} TransactionId
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        TransactionId.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.transaction.TransactionId();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.id = $root.primitives.Word.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Creates a TransactionId message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof transaction.TransactionId
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {transaction.TransactionId} TransactionId
         */
        TransactionId.fromObject = function fromObject(object, long) {
            if (object instanceof $root.transaction.TransactionId)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".transaction.TransactionId: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.transaction.TransactionId();
            if (object.id != null) {
                if (!$util.isObject(object.id))
                    throw TypeError(".transaction.TransactionId.id: object expected");
                message.id = $root.primitives.Word.fromObject(object.id, long + 1);
            }
            return message;
        };

        /**
         * Creates a plain object from a TransactionId message. Also converts values to other types if specified.
         * @function toObject
         * @memberof transaction.TransactionId
         * @static
         * @param {transaction.TransactionId} message TransactionId
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        TransactionId.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (options.defaults)
                object.id = null;
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                object.id = $root.primitives.Word.toObject(message.id, options, q + 1);
            return object;
        };

        /**
         * Converts this TransactionId to JSON.
         * @function toJSON
         * @memberof transaction.TransactionId
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        TransactionId.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for TransactionId
         * @function getTypeUrl
         * @memberof transaction.TransactionId
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        TransactionId.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/transaction.TransactionId";
        };

        return TransactionId;
    })();

    transaction.InputNoteCommitment = (function() {

        /**
         * Properties of an InputNoteCommitment.
         * @memberof transaction
         * @interface IInputNoteCommitment
         * @property {primitives.IWord|null} [nullifier] InputNoteCommitment nullifier
         * @property {note.INoteHeader|null} [header] InputNoteCommitment header
         */

        /**
         * Constructs a new InputNoteCommitment.
         * @memberof transaction
         * @classdesc Represents an InputNoteCommitment.
         * @implements IInputNoteCommitment
         * @constructor
         * @param {transaction.IInputNoteCommitment=} [properties] Properties to set
         */
        function InputNoteCommitment(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * InputNoteCommitment nullifier.
         * @member {primitives.IWord|null|undefined} nullifier
         * @memberof transaction.InputNoteCommitment
         * @instance
         */
        InputNoteCommitment.prototype.nullifier = null;

        /**
         * InputNoteCommitment header.
         * @member {note.INoteHeader|null|undefined} header
         * @memberof transaction.InputNoteCommitment
         * @instance
         */
        InputNoteCommitment.prototype.header = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(InputNoteCommitment.prototype, "_header", {
            get: $util.oneOfGetter($oneOfFields = ["header"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new InputNoteCommitment instance using the specified properties.
         * @function create
         * @memberof transaction.InputNoteCommitment
         * @static
         * @param {transaction.IInputNoteCommitment=} [properties] Properties to set
         * @returns {transaction.InputNoteCommitment} InputNoteCommitment instance
         */
        InputNoteCommitment.create = function create(properties) {
            return new InputNoteCommitment(properties);
        };

        /**
         * Encodes the specified InputNoteCommitment message. Does not implicitly {@link transaction.InputNoteCommitment.verify|verify} messages.
         * @function encode
         * @memberof transaction.InputNoteCommitment
         * @static
         * @param {transaction.IInputNoteCommitment} message InputNoteCommitment message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        InputNoteCommitment.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.nullifier != null && Object.hasOwnProperty.call(message, "nullifier"))
                $root.primitives.Word.encode(message.nullifier, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
            if (message.header != null && Object.hasOwnProperty.call(message, "header"))
                $root.note.NoteHeader.encode(message.header, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
            return writer;
        };

        /**
         * Decodes an InputNoteCommitment message from the specified reader or buffer.
         * @function decode
         * @memberof transaction.InputNoteCommitment
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {transaction.InputNoteCommitment} InputNoteCommitment
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        InputNoteCommitment.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.transaction.InputNoteCommitment();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.nullifier = $root.primitives.Word.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                case 2: {
                        message.header = $root.note.NoteHeader.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Creates an InputNoteCommitment message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof transaction.InputNoteCommitment
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {transaction.InputNoteCommitment} InputNoteCommitment
         */
        InputNoteCommitment.fromObject = function fromObject(object, long) {
            if (object instanceof $root.transaction.InputNoteCommitment)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".transaction.InputNoteCommitment: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.transaction.InputNoteCommitment();
            if (object.nullifier != null) {
                if (!$util.isObject(object.nullifier))
                    throw TypeError(".transaction.InputNoteCommitment.nullifier: object expected");
                message.nullifier = $root.primitives.Word.fromObject(object.nullifier, long + 1);
            }
            if (object.header != null) {
                if (!$util.isObject(object.header))
                    throw TypeError(".transaction.InputNoteCommitment.header: object expected");
                message.header = $root.note.NoteHeader.fromObject(object.header, long + 1);
            }
            return message;
        };

        /**
         * Creates a plain object from an InputNoteCommitment message. Also converts values to other types if specified.
         * @function toObject
         * @memberof transaction.InputNoteCommitment
         * @static
         * @param {transaction.InputNoteCommitment} message InputNoteCommitment
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        InputNoteCommitment.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (options.defaults)
                object.nullifier = null;
            if (message.nullifier != null && Object.hasOwnProperty.call(message, "nullifier"))
                object.nullifier = $root.primitives.Word.toObject(message.nullifier, options, q + 1);
            if (message.header != null && Object.hasOwnProperty.call(message, "header")) {
                object.header = $root.note.NoteHeader.toObject(message.header, options, q + 1);
                if (options.oneofs)
                    object._header = "header";
            }
            return object;
        };

        /**
         * Converts this InputNoteCommitment to JSON.
         * @function toJSON
         * @memberof transaction.InputNoteCommitment
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        InputNoteCommitment.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for InputNoteCommitment
         * @function getTypeUrl
         * @memberof transaction.InputNoteCommitment
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        InputNoteCommitment.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/transaction.InputNoteCommitment";
        };

        return InputNoteCommitment;
    })();

    transaction.TransactionHeader = (function() {

        /**
         * Properties of a TransactionHeader.
         * @memberof transaction
         * @interface ITransactionHeader
         * @property {transaction.ITransactionId|null} [transactionId] TransactionHeader transactionId
         * @property {account.IAccountId|null} [accountId] TransactionHeader accountId
         * @property {primitives.IWord|null} [initialStateCommitment] TransactionHeader initialStateCommitment
         * @property {primitives.IWord|null} [finalStateCommitment] TransactionHeader finalStateCommitment
         * @property {Array.<transaction.IInputNoteCommitment>|null} [inputNotes] TransactionHeader inputNotes
         * @property {Array.<note.INoteHeader>|null} [outputNotes] TransactionHeader outputNotes
         */

        /**
         * Constructs a new TransactionHeader.
         * @memberof transaction
         * @classdesc Represents a TransactionHeader.
         * @implements ITransactionHeader
         * @constructor
         * @param {transaction.ITransactionHeader=} [properties] Properties to set
         */
        function TransactionHeader(properties) {
            this.inputNotes = [];
            this.outputNotes = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * TransactionHeader transactionId.
         * @member {transaction.ITransactionId|null|undefined} transactionId
         * @memberof transaction.TransactionHeader
         * @instance
         */
        TransactionHeader.prototype.transactionId = null;

        /**
         * TransactionHeader accountId.
         * @member {account.IAccountId|null|undefined} accountId
         * @memberof transaction.TransactionHeader
         * @instance
         */
        TransactionHeader.prototype.accountId = null;

        /**
         * TransactionHeader initialStateCommitment.
         * @member {primitives.IWord|null|undefined} initialStateCommitment
         * @memberof transaction.TransactionHeader
         * @instance
         */
        TransactionHeader.prototype.initialStateCommitment = null;

        /**
         * TransactionHeader finalStateCommitment.
         * @member {primitives.IWord|null|undefined} finalStateCommitment
         * @memberof transaction.TransactionHeader
         * @instance
         */
        TransactionHeader.prototype.finalStateCommitment = null;

        /**
         * TransactionHeader inputNotes.
         * @member {Array.<transaction.IInputNoteCommitment>} inputNotes
         * @memberof transaction.TransactionHeader
         * @instance
         */
        TransactionHeader.prototype.inputNotes = $util.emptyArray;

        /**
         * TransactionHeader outputNotes.
         * @member {Array.<note.INoteHeader>} outputNotes
         * @memberof transaction.TransactionHeader
         * @instance
         */
        TransactionHeader.prototype.outputNotes = $util.emptyArray;

        /**
         * Creates a new TransactionHeader instance using the specified properties.
         * @function create
         * @memberof transaction.TransactionHeader
         * @static
         * @param {transaction.ITransactionHeader=} [properties] Properties to set
         * @returns {transaction.TransactionHeader} TransactionHeader instance
         */
        TransactionHeader.create = function create(properties) {
            return new TransactionHeader(properties);
        };

        /**
         * Encodes the specified TransactionHeader message. Does not implicitly {@link transaction.TransactionHeader.verify|verify} messages.
         * @function encode
         * @memberof transaction.TransactionHeader
         * @static
         * @param {transaction.ITransactionHeader} message TransactionHeader message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        TransactionHeader.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.transactionId != null && Object.hasOwnProperty.call(message, "transactionId"))
                $root.transaction.TransactionId.encode(message.transactionId, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
            if (message.accountId != null && Object.hasOwnProperty.call(message, "accountId"))
                $root.account.AccountId.encode(message.accountId, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
            if (message.initialStateCommitment != null && Object.hasOwnProperty.call(message, "initialStateCommitment"))
                $root.primitives.Word.encode(message.initialStateCommitment, writer.uint32(/* id 3, wireType 2 =*/26).fork(), q + 1).ldelim();
            if (message.finalStateCommitment != null && Object.hasOwnProperty.call(message, "finalStateCommitment"))
                $root.primitives.Word.encode(message.finalStateCommitment, writer.uint32(/* id 4, wireType 2 =*/34).fork(), q + 1).ldelim();
            if (message.inputNotes != null && message.inputNotes.length)
                for (let i = 0; i < message.inputNotes.length; ++i)
                    $root.transaction.InputNoteCommitment.encode(message.inputNotes[i], writer.uint32(/* id 5, wireType 2 =*/42).fork(), q + 1).ldelim();
            if (message.outputNotes != null && message.outputNotes.length)
                for (let i = 0; i < message.outputNotes.length; ++i)
                    $root.note.NoteHeader.encode(message.outputNotes[i], writer.uint32(/* id 6, wireType 2 =*/50).fork(), q + 1).ldelim();
            return writer;
        };

        /**
         * Decodes a TransactionHeader message from the specified reader or buffer.
         * @function decode
         * @memberof transaction.TransactionHeader
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {transaction.TransactionHeader} TransactionHeader
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        TransactionHeader.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.transaction.TransactionHeader();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.transactionId = $root.transaction.TransactionId.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                case 2: {
                        message.accountId = $root.account.AccountId.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                case 3: {
                        message.initialStateCommitment = $root.primitives.Word.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                case 4: {
                        message.finalStateCommitment = $root.primitives.Word.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                case 5: {
                        if (!(message.inputNotes && message.inputNotes.length))
                            message.inputNotes = [];
                        message.inputNotes.push($root.transaction.InputNoteCommitment.decode(reader, reader.uint32(), undefined, long + 1));
                        break;
                    }
                case 6: {
                        if (!(message.outputNotes && message.outputNotes.length))
                            message.outputNotes = [];
                        message.outputNotes.push($root.note.NoteHeader.decode(reader, reader.uint32(), undefined, long + 1));
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Creates a TransactionHeader message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof transaction.TransactionHeader
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {transaction.TransactionHeader} TransactionHeader
         */
        TransactionHeader.fromObject = function fromObject(object, long) {
            if (object instanceof $root.transaction.TransactionHeader)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".transaction.TransactionHeader: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.transaction.TransactionHeader();
            if (object.transactionId != null) {
                if (!$util.isObject(object.transactionId))
                    throw TypeError(".transaction.TransactionHeader.transactionId: object expected");
                message.transactionId = $root.transaction.TransactionId.fromObject(object.transactionId, long + 1);
            }
            if (object.accountId != null) {
                if (!$util.isObject(object.accountId))
                    throw TypeError(".transaction.TransactionHeader.accountId: object expected");
                message.accountId = $root.account.AccountId.fromObject(object.accountId, long + 1);
            }
            if (object.initialStateCommitment != null) {
                if (!$util.isObject(object.initialStateCommitment))
                    throw TypeError(".transaction.TransactionHeader.initialStateCommitment: object expected");
                message.initialStateCommitment = $root.primitives.Word.fromObject(object.initialStateCommitment, long + 1);
            }
            if (object.finalStateCommitment != null) {
                if (!$util.isObject(object.finalStateCommitment))
                    throw TypeError(".transaction.TransactionHeader.finalStateCommitment: object expected");
                message.finalStateCommitment = $root.primitives.Word.fromObject(object.finalStateCommitment, long + 1);
            }
            if (object.inputNotes) {
                if (!Array.isArray(object.inputNotes))
                    throw TypeError(".transaction.TransactionHeader.inputNotes: array expected");
                message.inputNotes = [];
                for (let i = 0; i < object.inputNotes.length; ++i) {
                    if (!$util.isObject(object.inputNotes[i]))
                        throw TypeError(".transaction.TransactionHeader.inputNotes: object expected");
                    message.inputNotes[i] = $root.transaction.InputNoteCommitment.fromObject(object.inputNotes[i], long + 1);
                }
            }
            if (object.outputNotes) {
                if (!Array.isArray(object.outputNotes))
                    throw TypeError(".transaction.TransactionHeader.outputNotes: array expected");
                message.outputNotes = [];
                for (let i = 0; i < object.outputNotes.length; ++i) {
                    if (!$util.isObject(object.outputNotes[i]))
                        throw TypeError(".transaction.TransactionHeader.outputNotes: object expected");
                    message.outputNotes[i] = $root.note.NoteHeader.fromObject(object.outputNotes[i], long + 1);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a TransactionHeader message. Also converts values to other types if specified.
         * @function toObject
         * @memberof transaction.TransactionHeader
         * @static
         * @param {transaction.TransactionHeader} message TransactionHeader
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        TransactionHeader.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (options.arrays || options.defaults) {
                object.inputNotes = [];
                object.outputNotes = [];
            }
            if (options.defaults) {
                object.transactionId = null;
                object.accountId = null;
                object.initialStateCommitment = null;
                object.finalStateCommitment = null;
            }
            if (message.transactionId != null && Object.hasOwnProperty.call(message, "transactionId"))
                object.transactionId = $root.transaction.TransactionId.toObject(message.transactionId, options, q + 1);
            if (message.accountId != null && Object.hasOwnProperty.call(message, "accountId"))
                object.accountId = $root.account.AccountId.toObject(message.accountId, options, q + 1);
            if (message.initialStateCommitment != null && Object.hasOwnProperty.call(message, "initialStateCommitment"))
                object.initialStateCommitment = $root.primitives.Word.toObject(message.initialStateCommitment, options, q + 1);
            if (message.finalStateCommitment != null && Object.hasOwnProperty.call(message, "finalStateCommitment"))
                object.finalStateCommitment = $root.primitives.Word.toObject(message.finalStateCommitment, options, q + 1);
            if (message.inputNotes && message.inputNotes.length) {
                object.inputNotes = [];
                for (let j = 0; j < message.inputNotes.length; ++j)
                    object.inputNotes[j] = $root.transaction.InputNoteCommitment.toObject(message.inputNotes[j], options, q + 1);
            }
            if (message.outputNotes && message.outputNotes.length) {
                object.outputNotes = [];
                for (let j = 0; j < message.outputNotes.length; ++j)
                    object.outputNotes[j] = $root.note.NoteHeader.toObject(message.outputNotes[j], options, q + 1);
            }
            return object;
        };

        /**
         * Converts this TransactionHeader to JSON.
         * @function toJSON
         * @memberof transaction.TransactionHeader
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        TransactionHeader.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for TransactionHeader
         * @function getTypeUrl
         * @memberof transaction.TransactionHeader
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        TransactionHeader.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/transaction.TransactionHeader";
        };

        return TransactionHeader;
    })();

    return transaction;
})();

export const blockchain = $root.blockchain = (() => {

    /**
     * Namespace blockchain.
     * @exports blockchain
     * @namespace
     */
    const blockchain = {};

    blockchain.BlockNumber = (function() {

        /**
         * Properties of a BlockNumber.
         * @memberof blockchain
         * @interface IBlockNumber
         * @property {number|null} [blockNum] BlockNumber blockNum
         */

        /**
         * Constructs a new BlockNumber.
         * @memberof blockchain
         * @classdesc Represents a BlockNumber.
         * @implements IBlockNumber
         * @constructor
         * @param {blockchain.IBlockNumber=} [properties] Properties to set
         */
        function BlockNumber(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * BlockNumber blockNum.
         * @member {number} blockNum
         * @memberof blockchain.BlockNumber
         * @instance
         */
        BlockNumber.prototype.blockNum = 0;

        /**
         * Creates a new BlockNumber instance using the specified properties.
         * @function create
         * @memberof blockchain.BlockNumber
         * @static
         * @param {blockchain.IBlockNumber=} [properties] Properties to set
         * @returns {blockchain.BlockNumber} BlockNumber instance
         */
        BlockNumber.create = function create(properties) {
            return new BlockNumber(properties);
        };

        /**
         * Encodes the specified BlockNumber message. Does not implicitly {@link blockchain.BlockNumber.verify|verify} messages.
         * @function encode
         * @memberof blockchain.BlockNumber
         * @static
         * @param {blockchain.IBlockNumber} message BlockNumber message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        BlockNumber.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.blockNum != null && Object.hasOwnProperty.call(message, "blockNum"))
                writer.uint32(/* id 1, wireType 5 =*/13).fixed32(message.blockNum);
            return writer;
        };

        /**
         * Decodes a BlockNumber message from the specified reader or buffer.
         * @function decode
         * @memberof blockchain.BlockNumber
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {blockchain.BlockNumber} BlockNumber
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        BlockNumber.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.blockchain.BlockNumber();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.blockNum = reader.fixed32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Creates a BlockNumber message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof blockchain.BlockNumber
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {blockchain.BlockNumber} BlockNumber
         */
        BlockNumber.fromObject = function fromObject(object, long) {
            if (object instanceof $root.blockchain.BlockNumber)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".blockchain.BlockNumber: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.blockchain.BlockNumber();
            if (object.blockNum != null)
                message.blockNum = object.blockNum >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a BlockNumber message. Also converts values to other types if specified.
         * @function toObject
         * @memberof blockchain.BlockNumber
         * @static
         * @param {blockchain.BlockNumber} message BlockNumber
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        BlockNumber.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (options.defaults)
                object.blockNum = 0;
            if (message.blockNum != null && Object.hasOwnProperty.call(message, "blockNum"))
                object.blockNum = message.blockNum;
            return object;
        };

        /**
         * Converts this BlockNumber to JSON.
         * @function toJSON
         * @memberof blockchain.BlockNumber
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        BlockNumber.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for BlockNumber
         * @function getTypeUrl
         * @memberof blockchain.BlockNumber
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        BlockNumber.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/blockchain.BlockNumber";
        };

        return BlockNumber;
    })();

    return blockchain;
})();

export const note = $root.note = (() => {

    /**
     * Namespace note.
     * @exports note
     * @namespace
     */
    const note = {};

    /**
     * NoteType enum.
     * @name note.NoteType
     * @enum {number}
     * @property {number} NOTE_TYPE_UNSPECIFIED=0 NOTE_TYPE_UNSPECIFIED value
     * @property {number} NOTE_TYPE_PRIVATE=1 NOTE_TYPE_PRIVATE value
     * @property {number} NOTE_TYPE_PUBLIC=2 NOTE_TYPE_PUBLIC value
     */
    note.NoteType = (function() {
        const valuesById = {}, values = Object.create(valuesById);
        values[valuesById[0] = "NOTE_TYPE_UNSPECIFIED"] = 0;
        values[valuesById[1] = "NOTE_TYPE_PRIVATE"] = 1;
        values[valuesById[2] = "NOTE_TYPE_PUBLIC"] = 2;
        return values;
    })();

    /**
     * NoteVersion enum.
     * @name note.NoteVersion
     * @enum {number}
     * @property {number} NOTE_VERSION_UNSPECIFIED=0 NOTE_VERSION_UNSPECIFIED value
     * @property {number} NOTE_VERSION_V1=1 NOTE_VERSION_V1 value
     */
    note.NoteVersion = (function() {
        const valuesById = {}, values = Object.create(valuesById);
        values[valuesById[0] = "NOTE_VERSION_UNSPECIFIED"] = 0;
        values[valuesById[1] = "NOTE_VERSION_V1"] = 1;
        return values;
    })();

    note.NoteId = (function() {

        /**
         * Properties of a NoteId.
         * @memberof note
         * @interface INoteId
         * @property {primitives.IWord|null} [id] NoteId id
         */

        /**
         * Constructs a new NoteId.
         * @memberof note
         * @classdesc Represents a NoteId.
         * @implements INoteId
         * @constructor
         * @param {note.INoteId=} [properties] Properties to set
         */
        function NoteId(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * NoteId id.
         * @member {primitives.IWord|null|undefined} id
         * @memberof note.NoteId
         * @instance
         */
        NoteId.prototype.id = null;

        /**
         * Creates a new NoteId instance using the specified properties.
         * @function create
         * @memberof note.NoteId
         * @static
         * @param {note.INoteId=} [properties] Properties to set
         * @returns {note.NoteId} NoteId instance
         */
        NoteId.create = function create(properties) {
            return new NoteId(properties);
        };

        /**
         * Encodes the specified NoteId message. Does not implicitly {@link note.NoteId.verify|verify} messages.
         * @function encode
         * @memberof note.NoteId
         * @static
         * @param {note.INoteId} message NoteId message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        NoteId.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                $root.primitives.Word.encode(message.id, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
            return writer;
        };

        /**
         * Decodes a NoteId message from the specified reader or buffer.
         * @function decode
         * @memberof note.NoteId
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {note.NoteId} NoteId
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        NoteId.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.note.NoteId();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.id = $root.primitives.Word.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Creates a NoteId message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof note.NoteId
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {note.NoteId} NoteId
         */
        NoteId.fromObject = function fromObject(object, long) {
            if (object instanceof $root.note.NoteId)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".note.NoteId: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.note.NoteId();
            if (object.id != null) {
                if (!$util.isObject(object.id))
                    throw TypeError(".note.NoteId.id: object expected");
                message.id = $root.primitives.Word.fromObject(object.id, long + 1);
            }
            return message;
        };

        /**
         * Creates a plain object from a NoteId message. Also converts values to other types if specified.
         * @function toObject
         * @memberof note.NoteId
         * @static
         * @param {note.NoteId} message NoteId
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        NoteId.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (options.defaults)
                object.id = null;
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                object.id = $root.primitives.Word.toObject(message.id, options, q + 1);
            return object;
        };

        /**
         * Converts this NoteId to JSON.
         * @function toJSON
         * @memberof note.NoteId
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        NoteId.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for NoteId
         * @function getTypeUrl
         * @memberof note.NoteId
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        NoteId.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/note.NoteId";
        };

        return NoteId;
    })();

    note.NoteMetadata = (function() {

        /**
         * Properties of a NoteMetadata.
         * @memberof note
         * @interface INoteMetadata
         * @property {note.NoteVersion|null} [version] NoteMetadata version
         * @property {account.IAccountId|null} [sender] NoteMetadata sender
         * @property {note.NoteType|null} [noteType] NoteMetadata noteType
         * @property {number|null} [tag] NoteMetadata tag
         * @property {Array.<number>|null} [attachmentSchemes] NoteMetadata attachmentSchemes
         * @property {primitives.IWord|null} [attachmentsCommitment] NoteMetadata attachmentsCommitment
         */

        /**
         * Constructs a new NoteMetadata.
         * @memberof note
         * @classdesc Represents a NoteMetadata.
         * @implements INoteMetadata
         * @constructor
         * @param {note.INoteMetadata=} [properties] Properties to set
         */
        function NoteMetadata(properties) {
            this.attachmentSchemes = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * NoteMetadata version.
         * @member {note.NoteVersion} version
         * @memberof note.NoteMetadata
         * @instance
         */
        NoteMetadata.prototype.version = 0;

        /**
         * NoteMetadata sender.
         * @member {account.IAccountId|null|undefined} sender
         * @memberof note.NoteMetadata
         * @instance
         */
        NoteMetadata.prototype.sender = null;

        /**
         * NoteMetadata noteType.
         * @member {note.NoteType} noteType
         * @memberof note.NoteMetadata
         * @instance
         */
        NoteMetadata.prototype.noteType = 0;

        /**
         * NoteMetadata tag.
         * @member {number} tag
         * @memberof note.NoteMetadata
         * @instance
         */
        NoteMetadata.prototype.tag = 0;

        /**
         * NoteMetadata attachmentSchemes.
         * @member {Array.<number>} attachmentSchemes
         * @memberof note.NoteMetadata
         * @instance
         */
        NoteMetadata.prototype.attachmentSchemes = $util.emptyArray;

        /**
         * NoteMetadata attachmentsCommitment.
         * @member {primitives.IWord|null|undefined} attachmentsCommitment
         * @memberof note.NoteMetadata
         * @instance
         */
        NoteMetadata.prototype.attachmentsCommitment = null;

        /**
         * Creates a new NoteMetadata instance using the specified properties.
         * @function create
         * @memberof note.NoteMetadata
         * @static
         * @param {note.INoteMetadata=} [properties] Properties to set
         * @returns {note.NoteMetadata} NoteMetadata instance
         */
        NoteMetadata.create = function create(properties) {
            return new NoteMetadata(properties);
        };

        /**
         * Encodes the specified NoteMetadata message. Does not implicitly {@link note.NoteMetadata.verify|verify} messages.
         * @function encode
         * @memberof note.NoteMetadata
         * @static
         * @param {note.INoteMetadata} message NoteMetadata message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        NoteMetadata.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.version != null && Object.hasOwnProperty.call(message, "version"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.version);
            if (message.sender != null && Object.hasOwnProperty.call(message, "sender"))
                $root.account.AccountId.encode(message.sender, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
            if (message.noteType != null && Object.hasOwnProperty.call(message, "noteType"))
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.noteType);
            if (message.tag != null && Object.hasOwnProperty.call(message, "tag"))
                writer.uint32(/* id 4, wireType 5 =*/37).fixed32(message.tag);
            if (message.attachmentSchemes != null && message.attachmentSchemes.length) {
                writer.uint32(/* id 5, wireType 2 =*/42).fork();
                for (let i = 0; i < message.attachmentSchemes.length; ++i)
                    writer.fixed32(message.attachmentSchemes[i]);
                writer.ldelim();
            }
            if (message.attachmentsCommitment != null && Object.hasOwnProperty.call(message, "attachmentsCommitment"))
                $root.primitives.Word.encode(message.attachmentsCommitment, writer.uint32(/* id 6, wireType 2 =*/50).fork(), q + 1).ldelim();
            return writer;
        };

        /**
         * Decodes a NoteMetadata message from the specified reader or buffer.
         * @function decode
         * @memberof note.NoteMetadata
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {note.NoteMetadata} NoteMetadata
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        NoteMetadata.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.note.NoteMetadata();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.version = reader.int32();
                        break;
                    }
                case 2: {
                        message.sender = $root.account.AccountId.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                case 3: {
                        message.noteType = reader.int32();
                        break;
                    }
                case 4: {
                        message.tag = reader.fixed32();
                        break;
                    }
                case 5: {
                        if (!(message.attachmentSchemes && message.attachmentSchemes.length))
                            message.attachmentSchemes = [];
                        if ((tag & 7) === 2) {
                            let end2 = reader.uint32() + reader.pos;
                            if (end2 > reader.len)
                                throw RangeError("index out of range");
                            reader.len = end2;
                            while (reader.pos < end2)
                                message.attachmentSchemes.push(reader.fixed32());
                            if (reader.pos !== end2)
                                throw RangeError("index out of range");
                            reader.len = end;
                        } else
                            message.attachmentSchemes.push(reader.fixed32());
                        break;
                    }
                case 6: {
                        message.attachmentsCommitment = $root.primitives.Word.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Creates a NoteMetadata message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof note.NoteMetadata
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {note.NoteMetadata} NoteMetadata
         */
        NoteMetadata.fromObject = function fromObject(object, long) {
            if (object instanceof $root.note.NoteMetadata)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".note.NoteMetadata: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.note.NoteMetadata();
            switch (object.version) {
            default:
                if (typeof object.version === "number") {
                    message.version = object.version;
                    break;
                }
                break;
            case "NOTE_VERSION_UNSPECIFIED":
            case 0:
                message.version = 0;
                break;
            case "NOTE_VERSION_V1":
            case 1:
                message.version = 1;
                break;
            }
            if (object.sender != null) {
                if (!$util.isObject(object.sender))
                    throw TypeError(".note.NoteMetadata.sender: object expected");
                message.sender = $root.account.AccountId.fromObject(object.sender, long + 1);
            }
            switch (object.noteType) {
            default:
                if (typeof object.noteType === "number") {
                    message.noteType = object.noteType;
                    break;
                }
                break;
            case "NOTE_TYPE_UNSPECIFIED":
            case 0:
                message.noteType = 0;
                break;
            case "NOTE_TYPE_PRIVATE":
            case 1:
                message.noteType = 1;
                break;
            case "NOTE_TYPE_PUBLIC":
            case 2:
                message.noteType = 2;
                break;
            }
            if (object.tag != null)
                message.tag = object.tag >>> 0;
            if (object.attachmentSchemes) {
                if (!Array.isArray(object.attachmentSchemes))
                    throw TypeError(".note.NoteMetadata.attachmentSchemes: array expected");
                message.attachmentSchemes = [];
                for (let i = 0; i < object.attachmentSchemes.length; ++i)
                    message.attachmentSchemes[i] = object.attachmentSchemes[i] >>> 0;
            }
            if (object.attachmentsCommitment != null) {
                if (!$util.isObject(object.attachmentsCommitment))
                    throw TypeError(".note.NoteMetadata.attachmentsCommitment: object expected");
                message.attachmentsCommitment = $root.primitives.Word.fromObject(object.attachmentsCommitment, long + 1);
            }
            return message;
        };

        /**
         * Creates a plain object from a NoteMetadata message. Also converts values to other types if specified.
         * @function toObject
         * @memberof note.NoteMetadata
         * @static
         * @param {note.NoteMetadata} message NoteMetadata
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        NoteMetadata.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (options.arrays || options.defaults)
                object.attachmentSchemes = [];
            if (options.defaults) {
                object.version = options.enums === String ? "NOTE_VERSION_UNSPECIFIED" : 0;
                object.sender = null;
                object.noteType = options.enums === String ? "NOTE_TYPE_UNSPECIFIED" : 0;
                object.tag = 0;
                object.attachmentsCommitment = null;
            }
            if (message.version != null && Object.hasOwnProperty.call(message, "version"))
                object.version = options.enums === String ? $root.note.NoteVersion[message.version] === undefined ? message.version : $root.note.NoteVersion[message.version] : message.version;
            if (message.sender != null && Object.hasOwnProperty.call(message, "sender"))
                object.sender = $root.account.AccountId.toObject(message.sender, options, q + 1);
            if (message.noteType != null && Object.hasOwnProperty.call(message, "noteType"))
                object.noteType = options.enums === String ? $root.note.NoteType[message.noteType] === undefined ? message.noteType : $root.note.NoteType[message.noteType] : message.noteType;
            if (message.tag != null && Object.hasOwnProperty.call(message, "tag"))
                object.tag = message.tag;
            if (message.attachmentSchemes && message.attachmentSchemes.length) {
                object.attachmentSchemes = [];
                for (let j = 0; j < message.attachmentSchemes.length; ++j)
                    object.attachmentSchemes[j] = message.attachmentSchemes[j];
            }
            if (message.attachmentsCommitment != null && Object.hasOwnProperty.call(message, "attachmentsCommitment"))
                object.attachmentsCommitment = $root.primitives.Word.toObject(message.attachmentsCommitment, options, q + 1);
            return object;
        };

        /**
         * Converts this NoteMetadata to JSON.
         * @function toJSON
         * @memberof note.NoteMetadata
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        NoteMetadata.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for NoteMetadata
         * @function getTypeUrl
         * @memberof note.NoteMetadata
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        NoteMetadata.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/note.NoteMetadata";
        };

        return NoteMetadata;
    })();

    note.NoteInclusionProof = (function() {

        /**
         * Properties of a NoteInclusionProof.
         * @memberof note
         * @interface INoteInclusionProof
         * @property {note.INoteId|null} [noteId] NoteInclusionProof noteId
         * @property {blockchain.IBlockNumber|null} [blockNum] NoteInclusionProof blockNum
         * @property {number|null} [noteIndexInBlock] NoteInclusionProof noteIndexInBlock
         * @property {primitives.ISparseMerklePath|null} [inclusionPath] NoteInclusionProof inclusionPath
         */

        /**
         * Constructs a new NoteInclusionProof.
         * @memberof note
         * @classdesc Represents a NoteInclusionProof.
         * @implements INoteInclusionProof
         * @constructor
         * @param {note.INoteInclusionProof=} [properties] Properties to set
         */
        function NoteInclusionProof(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * NoteInclusionProof noteId.
         * @member {note.INoteId|null|undefined} noteId
         * @memberof note.NoteInclusionProof
         * @instance
         */
        NoteInclusionProof.prototype.noteId = null;

        /**
         * NoteInclusionProof blockNum.
         * @member {blockchain.IBlockNumber|null|undefined} blockNum
         * @memberof note.NoteInclusionProof
         * @instance
         */
        NoteInclusionProof.prototype.blockNum = null;

        /**
         * NoteInclusionProof noteIndexInBlock.
         * @member {number} noteIndexInBlock
         * @memberof note.NoteInclusionProof
         * @instance
         */
        NoteInclusionProof.prototype.noteIndexInBlock = 0;

        /**
         * NoteInclusionProof inclusionPath.
         * @member {primitives.ISparseMerklePath|null|undefined} inclusionPath
         * @memberof note.NoteInclusionProof
         * @instance
         */
        NoteInclusionProof.prototype.inclusionPath = null;

        /**
         * Creates a new NoteInclusionProof instance using the specified properties.
         * @function create
         * @memberof note.NoteInclusionProof
         * @static
         * @param {note.INoteInclusionProof=} [properties] Properties to set
         * @returns {note.NoteInclusionProof} NoteInclusionProof instance
         */
        NoteInclusionProof.create = function create(properties) {
            return new NoteInclusionProof(properties);
        };

        /**
         * Encodes the specified NoteInclusionProof message. Does not implicitly {@link note.NoteInclusionProof.verify|verify} messages.
         * @function encode
         * @memberof note.NoteInclusionProof
         * @static
         * @param {note.INoteInclusionProof} message NoteInclusionProof message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        NoteInclusionProof.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.noteId != null && Object.hasOwnProperty.call(message, "noteId"))
                $root.note.NoteId.encode(message.noteId, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
            if (message.blockNum != null && Object.hasOwnProperty.call(message, "blockNum"))
                $root.blockchain.BlockNumber.encode(message.blockNum, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
            if (message.noteIndexInBlock != null && Object.hasOwnProperty.call(message, "noteIndexInBlock"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.noteIndexInBlock);
            if (message.inclusionPath != null && Object.hasOwnProperty.call(message, "inclusionPath"))
                $root.primitives.SparseMerklePath.encode(message.inclusionPath, writer.uint32(/* id 4, wireType 2 =*/34).fork(), q + 1).ldelim();
            return writer;
        };

        /**
         * Decodes a NoteInclusionProof message from the specified reader or buffer.
         * @function decode
         * @memberof note.NoteInclusionProof
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {note.NoteInclusionProof} NoteInclusionProof
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        NoteInclusionProof.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.note.NoteInclusionProof();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.noteId = $root.note.NoteId.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                case 2: {
                        message.blockNum = $root.blockchain.BlockNumber.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                case 3: {
                        message.noteIndexInBlock = reader.uint32();
                        break;
                    }
                case 4: {
                        message.inclusionPath = $root.primitives.SparseMerklePath.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Creates a NoteInclusionProof message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof note.NoteInclusionProof
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {note.NoteInclusionProof} NoteInclusionProof
         */
        NoteInclusionProof.fromObject = function fromObject(object, long) {
            if (object instanceof $root.note.NoteInclusionProof)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".note.NoteInclusionProof: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.note.NoteInclusionProof();
            if (object.noteId != null) {
                if (!$util.isObject(object.noteId))
                    throw TypeError(".note.NoteInclusionProof.noteId: object expected");
                message.noteId = $root.note.NoteId.fromObject(object.noteId, long + 1);
            }
            if (object.blockNum != null) {
                if (!$util.isObject(object.blockNum))
                    throw TypeError(".note.NoteInclusionProof.blockNum: object expected");
                message.blockNum = $root.blockchain.BlockNumber.fromObject(object.blockNum, long + 1);
            }
            if (object.noteIndexInBlock != null)
                message.noteIndexInBlock = object.noteIndexInBlock >>> 0;
            if (object.inclusionPath != null) {
                if (!$util.isObject(object.inclusionPath))
                    throw TypeError(".note.NoteInclusionProof.inclusionPath: object expected");
                message.inclusionPath = $root.primitives.SparseMerklePath.fromObject(object.inclusionPath, long + 1);
            }
            return message;
        };

        /**
         * Creates a plain object from a NoteInclusionProof message. Also converts values to other types if specified.
         * @function toObject
         * @memberof note.NoteInclusionProof
         * @static
         * @param {note.NoteInclusionProof} message NoteInclusionProof
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        NoteInclusionProof.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (options.defaults) {
                object.noteId = null;
                object.blockNum = null;
                object.noteIndexInBlock = 0;
                object.inclusionPath = null;
            }
            if (message.noteId != null && Object.hasOwnProperty.call(message, "noteId"))
                object.noteId = $root.note.NoteId.toObject(message.noteId, options, q + 1);
            if (message.blockNum != null && Object.hasOwnProperty.call(message, "blockNum"))
                object.blockNum = $root.blockchain.BlockNumber.toObject(message.blockNum, options, q + 1);
            if (message.noteIndexInBlock != null && Object.hasOwnProperty.call(message, "noteIndexInBlock"))
                object.noteIndexInBlock = message.noteIndexInBlock;
            if (message.inclusionPath != null && Object.hasOwnProperty.call(message, "inclusionPath"))
                object.inclusionPath = $root.primitives.SparseMerklePath.toObject(message.inclusionPath, options, q + 1);
            return object;
        };

        /**
         * Converts this NoteInclusionProof to JSON.
         * @function toJSON
         * @memberof note.NoteInclusionProof
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        NoteInclusionProof.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for NoteInclusionProof
         * @function getTypeUrl
         * @memberof note.NoteInclusionProof
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        NoteInclusionProof.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/note.NoteInclusionProof";
        };

        return NoteInclusionProof;
    })();

    note.NoteHeader = (function() {

        /**
         * Properties of a NoteHeader.
         * @memberof note
         * @interface INoteHeader
         * @property {note.INoteMetadata|null} [metadata] NoteHeader metadata
         * @property {primitives.IWord|null} [detailsCommitment] NoteHeader detailsCommitment
         */

        /**
         * Constructs a new NoteHeader.
         * @memberof note
         * @classdesc Represents a NoteHeader.
         * @implements INoteHeader
         * @constructor
         * @param {note.INoteHeader=} [properties] Properties to set
         */
        function NoteHeader(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * NoteHeader metadata.
         * @member {note.INoteMetadata|null|undefined} metadata
         * @memberof note.NoteHeader
         * @instance
         */
        NoteHeader.prototype.metadata = null;

        /**
         * NoteHeader detailsCommitment.
         * @member {primitives.IWord|null|undefined} detailsCommitment
         * @memberof note.NoteHeader
         * @instance
         */
        NoteHeader.prototype.detailsCommitment = null;

        /**
         * Creates a new NoteHeader instance using the specified properties.
         * @function create
         * @memberof note.NoteHeader
         * @static
         * @param {note.INoteHeader=} [properties] Properties to set
         * @returns {note.NoteHeader} NoteHeader instance
         */
        NoteHeader.create = function create(properties) {
            return new NoteHeader(properties);
        };

        /**
         * Encodes the specified NoteHeader message. Does not implicitly {@link note.NoteHeader.verify|verify} messages.
         * @function encode
         * @memberof note.NoteHeader
         * @static
         * @param {note.INoteHeader} message NoteHeader message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        NoteHeader.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.metadata != null && Object.hasOwnProperty.call(message, "metadata"))
                $root.note.NoteMetadata.encode(message.metadata, writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
            if (message.detailsCommitment != null && Object.hasOwnProperty.call(message, "detailsCommitment"))
                $root.primitives.Word.encode(message.detailsCommitment, writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim();
            return writer;
        };

        /**
         * Decodes a NoteHeader message from the specified reader or buffer.
         * @function decode
         * @memberof note.NoteHeader
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {note.NoteHeader} NoteHeader
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        NoteHeader.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end, message;
            if (length === undefined)
                end = reader.len;
            else {
                end = reader.pos + length;
                if (end > reader.len)
                    throw RangeError("index out of range");
                length = reader.len;
                reader.len = end;
            }
            message = new $root.note.NoteHeader();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.metadata = $root.note.NoteMetadata.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                case 2: {
                        message.detailsCommitment = $root.primitives.Word.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            if (length !== undefined) {
                if (reader.pos !== end)
                    throw RangeError("index out of range");
                reader.len = length;
            }
            return message;
        };

        /**
         * Creates a NoteHeader message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof note.NoteHeader
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {note.NoteHeader} NoteHeader
         */
        NoteHeader.fromObject = function fromObject(object, long) {
            if (object instanceof $root.note.NoteHeader)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".note.NoteHeader: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.note.NoteHeader();
            if (object.metadata != null) {
                if (!$util.isObject(object.metadata))
                    throw TypeError(".note.NoteHeader.metadata: object expected");
                message.metadata = $root.note.NoteMetadata.fromObject(object.metadata, long + 1);
            }
            if (object.detailsCommitment != null) {
                if (!$util.isObject(object.detailsCommitment))
                    throw TypeError(".note.NoteHeader.detailsCommitment: object expected");
                message.detailsCommitment = $root.primitives.Word.fromObject(object.detailsCommitment, long + 1);
            }
            return message;
        };

        /**
         * Creates a plain object from a NoteHeader message. Also converts values to other types if specified.
         * @function toObject
         * @memberof note.NoteHeader
         * @static
         * @param {note.NoteHeader} message NoteHeader
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        NoteHeader.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (options.defaults) {
                object.metadata = null;
                object.detailsCommitment = null;
            }
            if (message.metadata != null && Object.hasOwnProperty.call(message, "metadata"))
                object.metadata = $root.note.NoteMetadata.toObject(message.metadata, options, q + 1);
            if (message.detailsCommitment != null && Object.hasOwnProperty.call(message, "detailsCommitment"))
                object.detailsCommitment = $root.primitives.Word.toObject(message.detailsCommitment, options, q + 1);
            return object;
        };

        /**
         * Converts this NoteHeader to JSON.
         * @function toJSON
         * @memberof note.NoteHeader
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        NoteHeader.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for NoteHeader
         * @function getTypeUrl
         * @memberof note.NoteHeader
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        NoteHeader.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/note.NoteHeader";
        };

        return NoteHeader;
    })();

    return note;
})();

export { $root as default };
