import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace miden. */
export namespace miden {

    /** Namespace node. */
    namespace node {

        /** Namespace v1. */
        namespace v1 {

            /** Properties of a StatusRequest. */
            interface IStatusRequest {
            }

            /** Represents a StatusRequest. */
            class StatusRequest implements IStatusRequest {

                /**
                 * Constructs a new StatusRequest.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: miden.node.v1.IStatusRequest);

                /**
                 * Creates a new StatusRequest instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns StatusRequest instance
                 */
                public static create(properties?: miden.node.v1.IStatusRequest): miden.node.v1.StatusRequest;

                /**
                 * Encodes the specified StatusRequest message. Does not implicitly {@link miden.node.v1.StatusRequest.verify|verify} messages.
                 * @param message StatusRequest message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: miden.node.v1.IStatusRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a StatusRequest message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns StatusRequest
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): miden.node.v1.StatusRequest;

                /**
                 * Creates a StatusRequest message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns StatusRequest
                 */
                public static fromObject(object: { [k: string]: any }): miden.node.v1.StatusRequest;

                /**
                 * Creates a plain object from a StatusRequest message. Also converts values to other types if specified.
                 * @param message StatusRequest
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: miden.node.v1.StatusRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this StatusRequest to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for StatusRequest
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            /** Properties of a StatusResponse. */
            interface IStatusResponse {

                /** StatusResponse version */
                version?: (string|null);

                /** StatusResponse genesisCommitment */
                genesisCommitment?: (primitives.IWord|null);

                /** StatusResponse chainTip */
                chainTip?: (number|null);

                /** StatusResponse blockProducer */
                blockProducer?: (miden.node.v1.IBlockProducerStatus|null);
            }

            /** Represents a StatusResponse. */
            class StatusResponse implements IStatusResponse {

                /**
                 * Constructs a new StatusResponse.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: miden.node.v1.IStatusResponse);

                /** StatusResponse version. */
                public version: string;

                /** StatusResponse genesisCommitment. */
                public genesisCommitment?: (primitives.IWord|null);

                /** StatusResponse chainTip. */
                public chainTip: number;

                /** StatusResponse blockProducer. */
                public blockProducer?: (miden.node.v1.IBlockProducerStatus|null);

                /**
                 * Creates a new StatusResponse instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns StatusResponse instance
                 */
                public static create(properties?: miden.node.v1.IStatusResponse): miden.node.v1.StatusResponse;

                /**
                 * Encodes the specified StatusResponse message. Does not implicitly {@link miden.node.v1.StatusResponse.verify|verify} messages.
                 * @param message StatusResponse message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: miden.node.v1.IStatusResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a StatusResponse message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns StatusResponse
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): miden.node.v1.StatusResponse;

                /**
                 * Creates a StatusResponse message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns StatusResponse
                 */
                public static fromObject(object: { [k: string]: any }): miden.node.v1.StatusResponse;

                /**
                 * Creates a plain object from a StatusResponse message. Also converts values to other types if specified.
                 * @param message StatusResponse
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: miden.node.v1.StatusResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this StatusResponse to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for StatusResponse
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            /** Properties of a BlockProducerStatus. */
            interface IBlockProducerStatus {

                /** BlockProducerStatus version */
                version?: (string|null);

                /** BlockProducerStatus status */
                status?: (string|null);

                /** BlockProducerStatus chainTip */
                chainTip?: (number|null);

                /** BlockProducerStatus mempoolStats */
                mempoolStats?: (miden.node.v1.IMempoolStats|null);
            }

            /** Represents a BlockProducerStatus. */
            class BlockProducerStatus implements IBlockProducerStatus {

                /**
                 * Constructs a new BlockProducerStatus.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: miden.node.v1.IBlockProducerStatus);

                /** BlockProducerStatus version. */
                public version: string;

                /** BlockProducerStatus status. */
                public status: string;

                /** BlockProducerStatus chainTip. */
                public chainTip: number;

                /** BlockProducerStatus mempoolStats. */
                public mempoolStats?: (miden.node.v1.IMempoolStats|null);

                /**
                 * Creates a new BlockProducerStatus instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns BlockProducerStatus instance
                 */
                public static create(properties?: miden.node.v1.IBlockProducerStatus): miden.node.v1.BlockProducerStatus;

                /**
                 * Encodes the specified BlockProducerStatus message. Does not implicitly {@link miden.node.v1.BlockProducerStatus.verify|verify} messages.
                 * @param message BlockProducerStatus message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: miden.node.v1.IBlockProducerStatus, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a BlockProducerStatus message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns BlockProducerStatus
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): miden.node.v1.BlockProducerStatus;

                /**
                 * Creates a BlockProducerStatus message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns BlockProducerStatus
                 */
                public static fromObject(object: { [k: string]: any }): miden.node.v1.BlockProducerStatus;

                /**
                 * Creates a plain object from a BlockProducerStatus message. Also converts values to other types if specified.
                 * @param message BlockProducerStatus
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: miden.node.v1.BlockProducerStatus, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this BlockProducerStatus to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for BlockProducerStatus
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            /** Properties of a MempoolStats. */
            interface IMempoolStats {

                /** MempoolStats unbatchedTransactions */
                unbatchedTransactions?: (number|Long|null);

                /** MempoolStats proposedBatches */
                proposedBatches?: (number|Long|null);

                /** MempoolStats provenBatches */
                provenBatches?: (number|Long|null);

                /** MempoolStats uncommittedTransactions */
                uncommittedTransactions?: (number|Long|null);
            }

            /** Represents a MempoolStats. */
            class MempoolStats implements IMempoolStats {

                /**
                 * Constructs a new MempoolStats.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: miden.node.v1.IMempoolStats);

                /** MempoolStats unbatchedTransactions. */
                public unbatchedTransactions: (number|Long);

                /** MempoolStats proposedBatches. */
                public proposedBatches: (number|Long);

                /** MempoolStats provenBatches. */
                public provenBatches: (number|Long);

                /** MempoolStats uncommittedTransactions. */
                public uncommittedTransactions: (number|Long);

                /**
                 * Creates a new MempoolStats instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns MempoolStats instance
                 */
                public static create(properties?: miden.node.v1.IMempoolStats): miden.node.v1.MempoolStats;

                /**
                 * Encodes the specified MempoolStats message. Does not implicitly {@link miden.node.v1.MempoolStats.verify|verify} messages.
                 * @param message MempoolStats message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: miden.node.v1.IMempoolStats, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a MempoolStats message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns MempoolStats
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): miden.node.v1.MempoolStats;

                /**
                 * Creates a MempoolStats message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns MempoolStats
                 */
                public static fromObject(object: { [k: string]: any }): miden.node.v1.MempoolStats;

                /**
                 * Creates a plain object from a MempoolStats message. Also converts values to other types if specified.
                 * @param message MempoolStats
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: miden.node.v1.MempoolStats, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this MempoolStats to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for MempoolStats
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            /** Properties of a BlockRange. */
            interface IBlockRange {

                /** BlockRange blockFrom */
                blockFrom?: (number|null);

                /** BlockRange blockTo */
                blockTo?: (number|null);
            }

            /** Represents a BlockRange. */
            class BlockRange implements IBlockRange {

                /**
                 * Constructs a new BlockRange.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: miden.node.v1.IBlockRange);

                /** BlockRange blockFrom. */
                public blockFrom: number;

                /** BlockRange blockTo. */
                public blockTo: number;

                /**
                 * Creates a new BlockRange instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns BlockRange instance
                 */
                public static create(properties?: miden.node.v1.IBlockRange): miden.node.v1.BlockRange;

                /**
                 * Encodes the specified BlockRange message. Does not implicitly {@link miden.node.v1.BlockRange.verify|verify} messages.
                 * @param message BlockRange message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: miden.node.v1.IBlockRange, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a BlockRange message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns BlockRange
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): miden.node.v1.BlockRange;

                /**
                 * Creates a BlockRange message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns BlockRange
                 */
                public static fromObject(object: { [k: string]: any }): miden.node.v1.BlockRange;

                /**
                 * Creates a plain object from a BlockRange message. Also converts values to other types if specified.
                 * @param message BlockRange
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: miden.node.v1.BlockRange, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this BlockRange to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for BlockRange
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            /** Properties of a PaginationInfo. */
            interface IPaginationInfo {

                /** PaginationInfo chainTip */
                chainTip?: (number|null);

                /** PaginationInfo blockNum */
                blockNum?: (number|null);
            }

            /** Represents a PaginationInfo. */
            class PaginationInfo implements IPaginationInfo {

                /**
                 * Constructs a new PaginationInfo.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: miden.node.v1.IPaginationInfo);

                /** PaginationInfo chainTip. */
                public chainTip: number;

                /** PaginationInfo blockNum. */
                public blockNum: number;

                /**
                 * Creates a new PaginationInfo instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns PaginationInfo instance
                 */
                public static create(properties?: miden.node.v1.IPaginationInfo): miden.node.v1.PaginationInfo;

                /**
                 * Encodes the specified PaginationInfo message. Does not implicitly {@link miden.node.v1.PaginationInfo.verify|verify} messages.
                 * @param message PaginationInfo message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: miden.node.v1.IPaginationInfo, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a PaginationInfo message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns PaginationInfo
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): miden.node.v1.PaginationInfo;

                /**
                 * Creates a PaginationInfo message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns PaginationInfo
                 */
                public static fromObject(object: { [k: string]: any }): miden.node.v1.PaginationInfo;

                /**
                 * Creates a plain object from a PaginationInfo message. Also converts values to other types if specified.
                 * @param message PaginationInfo
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: miden.node.v1.PaginationInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this PaginationInfo to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for PaginationInfo
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            /** Properties of a SyncTransactionsRequest. */
            interface ISyncTransactionsRequest {

                /** SyncTransactionsRequest blockRange */
                blockRange?: (miden.node.v1.IBlockRange|null);

                /** SyncTransactionsRequest accountIds */
                accountIds?: (account.IAccountId[]|null);
            }

            /** Represents a SyncTransactionsRequest. */
            class SyncTransactionsRequest implements ISyncTransactionsRequest {

                /**
                 * Constructs a new SyncTransactionsRequest.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: miden.node.v1.ISyncTransactionsRequest);

                /** SyncTransactionsRequest blockRange. */
                public blockRange?: (miden.node.v1.IBlockRange|null);

                /** SyncTransactionsRequest accountIds. */
                public accountIds: account.IAccountId[];

                /**
                 * Creates a new SyncTransactionsRequest instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns SyncTransactionsRequest instance
                 */
                public static create(properties?: miden.node.v1.ISyncTransactionsRequest): miden.node.v1.SyncTransactionsRequest;

                /**
                 * Encodes the specified SyncTransactionsRequest message. Does not implicitly {@link miden.node.v1.SyncTransactionsRequest.verify|verify} messages.
                 * @param message SyncTransactionsRequest message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: miden.node.v1.ISyncTransactionsRequest, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a SyncTransactionsRequest message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns SyncTransactionsRequest
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): miden.node.v1.SyncTransactionsRequest;

                /**
                 * Creates a SyncTransactionsRequest message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns SyncTransactionsRequest
                 */
                public static fromObject(object: { [k: string]: any }): miden.node.v1.SyncTransactionsRequest;

                /**
                 * Creates a plain object from a SyncTransactionsRequest message. Also converts values to other types if specified.
                 * @param message SyncTransactionsRequest
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: miden.node.v1.SyncTransactionsRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this SyncTransactionsRequest to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for SyncTransactionsRequest
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            /** Properties of a SyncTransactionsResponse. */
            interface ISyncTransactionsResponse {

                /** SyncTransactionsResponse paginationInfo */
                paginationInfo?: (miden.node.v1.IPaginationInfo|null);

                /** SyncTransactionsResponse transactions */
                transactions?: (miden.node.v1.ITransactionRecord[]|null);
            }

            /** Represents a SyncTransactionsResponse. */
            class SyncTransactionsResponse implements ISyncTransactionsResponse {

                /**
                 * Constructs a new SyncTransactionsResponse.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: miden.node.v1.ISyncTransactionsResponse);

                /** SyncTransactionsResponse paginationInfo. */
                public paginationInfo?: (miden.node.v1.IPaginationInfo|null);

                /** SyncTransactionsResponse transactions. */
                public transactions: miden.node.v1.ITransactionRecord[];

                /**
                 * Creates a new SyncTransactionsResponse instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns SyncTransactionsResponse instance
                 */
                public static create(properties?: miden.node.v1.ISyncTransactionsResponse): miden.node.v1.SyncTransactionsResponse;

                /**
                 * Encodes the specified SyncTransactionsResponse message. Does not implicitly {@link miden.node.v1.SyncTransactionsResponse.verify|verify} messages.
                 * @param message SyncTransactionsResponse message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: miden.node.v1.ISyncTransactionsResponse, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a SyncTransactionsResponse message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns SyncTransactionsResponse
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): miden.node.v1.SyncTransactionsResponse;

                /**
                 * Creates a SyncTransactionsResponse message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns SyncTransactionsResponse
                 */
                public static fromObject(object: { [k: string]: any }): miden.node.v1.SyncTransactionsResponse;

                /**
                 * Creates a plain object from a SyncTransactionsResponse message. Also converts values to other types if specified.
                 * @param message SyncTransactionsResponse
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: miden.node.v1.SyncTransactionsResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this SyncTransactionsResponse to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for SyncTransactionsResponse
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            /** Properties of a TransactionRecord. */
            interface ITransactionRecord {

                /** TransactionRecord blockNum */
                blockNum?: (number|null);

                /** TransactionRecord header */
                header?: (transaction.ITransactionHeader|null);

                /** TransactionRecord outputNoteProofs */
                outputNoteProofs?: (note.INoteInclusionProof[]|null);

                /** TransactionRecord consumedNoteRefs */
                consumedNoteRefs?: (miden.node.v1.IConsumedNoteRef[]|null);
            }

            /** Represents a TransactionRecord. */
            class TransactionRecord implements ITransactionRecord {

                /**
                 * Constructs a new TransactionRecord.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: miden.node.v1.ITransactionRecord);

                /** TransactionRecord blockNum. */
                public blockNum: number;

                /** TransactionRecord header. */
                public header?: (transaction.ITransactionHeader|null);

                /** TransactionRecord outputNoteProofs. */
                public outputNoteProofs: note.INoteInclusionProof[];

                /** TransactionRecord consumedNoteRefs. */
                public consumedNoteRefs: miden.node.v1.IConsumedNoteRef[];

                /**
                 * Creates a new TransactionRecord instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns TransactionRecord instance
                 */
                public static create(properties?: miden.node.v1.ITransactionRecord): miden.node.v1.TransactionRecord;

                /**
                 * Encodes the specified TransactionRecord message. Does not implicitly {@link miden.node.v1.TransactionRecord.verify|verify} messages.
                 * @param message TransactionRecord message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: miden.node.v1.ITransactionRecord, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a TransactionRecord message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns TransactionRecord
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): miden.node.v1.TransactionRecord;

                /**
                 * Creates a TransactionRecord message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns TransactionRecord
                 */
                public static fromObject(object: { [k: string]: any }): miden.node.v1.TransactionRecord;

                /**
                 * Creates a plain object from a TransactionRecord message. Also converts values to other types if specified.
                 * @param message TransactionRecord
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: miden.node.v1.TransactionRecord, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this TransactionRecord to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for TransactionRecord
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }

            /** Properties of a ConsumedNoteRef. */
            interface IConsumedNoteRef {

                /** ConsumedNoteRef nullifier */
                nullifier?: (primitives.IWord|null);

                /** ConsumedNoteRef noteId */
                noteId?: (note.INoteId|null);
            }

            /** Represents a ConsumedNoteRef. */
            class ConsumedNoteRef implements IConsumedNoteRef {

                /**
                 * Constructs a new ConsumedNoteRef.
                 * @param [properties] Properties to set
                 */
                constructor(properties?: miden.node.v1.IConsumedNoteRef);

                /** ConsumedNoteRef nullifier. */
                public nullifier?: (primitives.IWord|null);

                /** ConsumedNoteRef noteId. */
                public noteId?: (note.INoteId|null);

                /**
                 * Creates a new ConsumedNoteRef instance using the specified properties.
                 * @param [properties] Properties to set
                 * @returns ConsumedNoteRef instance
                 */
                public static create(properties?: miden.node.v1.IConsumedNoteRef): miden.node.v1.ConsumedNoteRef;

                /**
                 * Encodes the specified ConsumedNoteRef message. Does not implicitly {@link miden.node.v1.ConsumedNoteRef.verify|verify} messages.
                 * @param message ConsumedNoteRef message or plain object to encode
                 * @param [writer] Writer to encode to
                 * @returns Writer
                 */
                public static encode(message: miden.node.v1.IConsumedNoteRef, writer?: $protobuf.Writer): $protobuf.Writer;

                /**
                 * Decodes a ConsumedNoteRef message from the specified reader or buffer.
                 * @param reader Reader or buffer to decode from
                 * @param [length] Message length if known beforehand
                 * @returns ConsumedNoteRef
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {$protobuf.util.ProtocolError} If required fields are missing
                 */
                public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): miden.node.v1.ConsumedNoteRef;

                /**
                 * Creates a ConsumedNoteRef message from a plain object. Also converts values to their respective internal types.
                 * @param object Plain object
                 * @returns ConsumedNoteRef
                 */
                public static fromObject(object: { [k: string]: any }): miden.node.v1.ConsumedNoteRef;

                /**
                 * Creates a plain object from a ConsumedNoteRef message. Also converts values to other types if specified.
                 * @param message ConsumedNoteRef
                 * @param [options] Conversion options
                 * @returns Plain object
                 */
                public static toObject(message: miden.node.v1.ConsumedNoteRef, options?: $protobuf.IConversionOptions): { [k: string]: any };

                /**
                 * Converts this ConsumedNoteRef to JSON.
                 * @returns JSON object
                 */
                public toJSON(): { [k: string]: any };

                /**
                 * Gets the default type url for ConsumedNoteRef
                 * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                 * @returns The default type url
                 */
                public static getTypeUrl(typeUrlPrefix?: string): string;
            }
        }
    }
}

/** Namespace account. */
export namespace account {

    /** Properties of an AccountId. */
    interface IAccountId {

        /** AccountId v1 */
        v1?: (account.IAccountIdV1|null);
    }

    /** Represents an AccountId. */
    class AccountId implements IAccountId {

        /**
         * Constructs a new AccountId.
         * @param [properties] Properties to set
         */
        constructor(properties?: account.IAccountId);

        /** AccountId v1. */
        public v1?: (account.IAccountIdV1|null);

        /** AccountId version. */
        public version?: "v1";

        /**
         * Creates a new AccountId instance using the specified properties.
         * @param [properties] Properties to set
         * @returns AccountId instance
         */
        public static create(properties?: account.IAccountId): account.AccountId;

        /**
         * Encodes the specified AccountId message. Does not implicitly {@link account.AccountId.verify|verify} messages.
         * @param message AccountId message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: account.IAccountId, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an AccountId message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns AccountId
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): account.AccountId;

        /**
         * Creates an AccountId message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns AccountId
         */
        public static fromObject(object: { [k: string]: any }): account.AccountId;

        /**
         * Creates a plain object from an AccountId message. Also converts values to other types if specified.
         * @param message AccountId
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: account.AccountId, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this AccountId to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for AccountId
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an AccountIdV1. */
    interface IAccountIdV1 {

        /** AccountIdV1 suffix */
        suffix?: (primitives.IFelt|null);

        /** AccountIdV1 prefix */
        prefix?: (primitives.IFelt|null);
    }

    /** Represents an AccountIdV1. */
    class AccountIdV1 implements IAccountIdV1 {

        /**
         * Constructs a new AccountIdV1.
         * @param [properties] Properties to set
         */
        constructor(properties?: account.IAccountIdV1);

        /** AccountIdV1 suffix. */
        public suffix?: (primitives.IFelt|null);

        /** AccountIdV1 prefix. */
        public prefix?: (primitives.IFelt|null);

        /**
         * Creates a new AccountIdV1 instance using the specified properties.
         * @param [properties] Properties to set
         * @returns AccountIdV1 instance
         */
        public static create(properties?: account.IAccountIdV1): account.AccountIdV1;

        /**
         * Encodes the specified AccountIdV1 message. Does not implicitly {@link account.AccountIdV1.verify|verify} messages.
         * @param message AccountIdV1 message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: account.IAccountIdV1, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an AccountIdV1 message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns AccountIdV1
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): account.AccountIdV1;

        /**
         * Creates an AccountIdV1 message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns AccountIdV1
         */
        public static fromObject(object: { [k: string]: any }): account.AccountIdV1;

        /**
         * Creates a plain object from an AccountIdV1 message. Also converts values to other types if specified.
         * @param message AccountIdV1
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: account.AccountIdV1, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this AccountIdV1 to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for AccountIdV1
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}

/** Namespace primitives. */
export namespace primitives {

    /** Properties of a Felt. */
    interface IFelt {

        /** Felt value */
        value?: (number|Long|null);
    }

    /** Represents a Felt. */
    class Felt implements IFelt {

        /**
         * Constructs a new Felt.
         * @param [properties] Properties to set
         */
        constructor(properties?: primitives.IFelt);

        /** Felt value. */
        public value: (number|Long);

        /**
         * Creates a new Felt instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Felt instance
         */
        public static create(properties?: primitives.IFelt): primitives.Felt;

        /**
         * Encodes the specified Felt message. Does not implicitly {@link primitives.Felt.verify|verify} messages.
         * @param message Felt message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: primitives.IFelt, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Felt message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Felt
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): primitives.Felt;

        /**
         * Creates a Felt message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Felt
         */
        public static fromObject(object: { [k: string]: any }): primitives.Felt;

        /**
         * Creates a plain object from a Felt message. Also converts values to other types if specified.
         * @param message Felt
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: primitives.Felt, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Felt to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Felt
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Word. */
    interface IWord {

        /** Word encoded */
        encoded?: (Uint8Array|null);
    }

    /** Represents a Word. */
    class Word implements IWord {

        /**
         * Constructs a new Word.
         * @param [properties] Properties to set
         */
        constructor(properties?: primitives.IWord);

        /** Word encoded. */
        public encoded: Uint8Array;

        /**
         * Creates a new Word instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Word instance
         */
        public static create(properties?: primitives.IWord): primitives.Word;

        /**
         * Encodes the specified Word message. Does not implicitly {@link primitives.Word.verify|verify} messages.
         * @param message Word message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: primitives.IWord, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Word message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Word
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): primitives.Word;

        /**
         * Creates a Word message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Word
         */
        public static fromObject(object: { [k: string]: any }): primitives.Word;

        /**
         * Creates a plain object from a Word message. Also converts values to other types if specified.
         * @param message Word
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: primitives.Word, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Word to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Word
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SparseMerklePath. */
    interface ISparseMerklePath {

        /** SparseMerklePath emptyNodesMask */
        emptyNodesMask?: (number|Long|null);

        /** SparseMerklePath siblings */
        siblings?: (primitives.IWord[]|null);
    }

    /** Represents a SparseMerklePath. */
    class SparseMerklePath implements ISparseMerklePath {

        /**
         * Constructs a new SparseMerklePath.
         * @param [properties] Properties to set
         */
        constructor(properties?: primitives.ISparseMerklePath);

        /** SparseMerklePath emptyNodesMask. */
        public emptyNodesMask: (number|Long);

        /** SparseMerklePath siblings. */
        public siblings: primitives.IWord[];

        /**
         * Creates a new SparseMerklePath instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SparseMerklePath instance
         */
        public static create(properties?: primitives.ISparseMerklePath): primitives.SparseMerklePath;

        /**
         * Encodes the specified SparseMerklePath message. Does not implicitly {@link primitives.SparseMerklePath.verify|verify} messages.
         * @param message SparseMerklePath message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: primitives.ISparseMerklePath, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a SparseMerklePath message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SparseMerklePath
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): primitives.SparseMerklePath;

        /**
         * Creates a SparseMerklePath message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SparseMerklePath
         */
        public static fromObject(object: { [k: string]: any }): primitives.SparseMerklePath;

        /**
         * Creates a plain object from a SparseMerklePath message. Also converts values to other types if specified.
         * @param message SparseMerklePath
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: primitives.SparseMerklePath, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this SparseMerklePath to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SparseMerklePath
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}

/** Namespace transaction. */
export namespace transaction {

    /** Properties of a TransactionId. */
    interface ITransactionId {

        /** TransactionId id */
        id?: (primitives.IWord|null);
    }

    /** Represents a TransactionId. */
    class TransactionId implements ITransactionId {

        /**
         * Constructs a new TransactionId.
         * @param [properties] Properties to set
         */
        constructor(properties?: transaction.ITransactionId);

        /** TransactionId id. */
        public id?: (primitives.IWord|null);

        /**
         * Creates a new TransactionId instance using the specified properties.
         * @param [properties] Properties to set
         * @returns TransactionId instance
         */
        public static create(properties?: transaction.ITransactionId): transaction.TransactionId;

        /**
         * Encodes the specified TransactionId message. Does not implicitly {@link transaction.TransactionId.verify|verify} messages.
         * @param message TransactionId message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: transaction.ITransactionId, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a TransactionId message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns TransactionId
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): transaction.TransactionId;

        /**
         * Creates a TransactionId message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns TransactionId
         */
        public static fromObject(object: { [k: string]: any }): transaction.TransactionId;

        /**
         * Creates a plain object from a TransactionId message. Also converts values to other types if specified.
         * @param message TransactionId
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: transaction.TransactionId, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this TransactionId to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for TransactionId
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an InputNoteCommitment. */
    interface IInputNoteCommitment {

        /** InputNoteCommitment nullifier */
        nullifier?: (primitives.IWord|null);

        /** InputNoteCommitment header */
        header?: (note.INoteHeader|null);
    }

    /** Represents an InputNoteCommitment. */
    class InputNoteCommitment implements IInputNoteCommitment {

        /**
         * Constructs a new InputNoteCommitment.
         * @param [properties] Properties to set
         */
        constructor(properties?: transaction.IInputNoteCommitment);

        /** InputNoteCommitment nullifier. */
        public nullifier?: (primitives.IWord|null);

        /** InputNoteCommitment header. */
        public header?: (note.INoteHeader|null);

        /**
         * Creates a new InputNoteCommitment instance using the specified properties.
         * @param [properties] Properties to set
         * @returns InputNoteCommitment instance
         */
        public static create(properties?: transaction.IInputNoteCommitment): transaction.InputNoteCommitment;

        /**
         * Encodes the specified InputNoteCommitment message. Does not implicitly {@link transaction.InputNoteCommitment.verify|verify} messages.
         * @param message InputNoteCommitment message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: transaction.IInputNoteCommitment, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an InputNoteCommitment message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns InputNoteCommitment
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): transaction.InputNoteCommitment;

        /**
         * Creates an InputNoteCommitment message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns InputNoteCommitment
         */
        public static fromObject(object: { [k: string]: any }): transaction.InputNoteCommitment;

        /**
         * Creates a plain object from an InputNoteCommitment message. Also converts values to other types if specified.
         * @param message InputNoteCommitment
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: transaction.InputNoteCommitment, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this InputNoteCommitment to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for InputNoteCommitment
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a TransactionHeader. */
    interface ITransactionHeader {

        /** TransactionHeader transactionId */
        transactionId?: (transaction.ITransactionId|null);

        /** TransactionHeader accountId */
        accountId?: (account.IAccountId|null);

        /** TransactionHeader initialStateCommitment */
        initialStateCommitment?: (primitives.IWord|null);

        /** TransactionHeader finalStateCommitment */
        finalStateCommitment?: (primitives.IWord|null);

        /** TransactionHeader inputNotes */
        inputNotes?: (transaction.IInputNoteCommitment[]|null);

        /** TransactionHeader outputNotes */
        outputNotes?: (note.INoteHeader[]|null);
    }

    /** Represents a TransactionHeader. */
    class TransactionHeader implements ITransactionHeader {

        /**
         * Constructs a new TransactionHeader.
         * @param [properties] Properties to set
         */
        constructor(properties?: transaction.ITransactionHeader);

        /** TransactionHeader transactionId. */
        public transactionId?: (transaction.ITransactionId|null);

        /** TransactionHeader accountId. */
        public accountId?: (account.IAccountId|null);

        /** TransactionHeader initialStateCommitment. */
        public initialStateCommitment?: (primitives.IWord|null);

        /** TransactionHeader finalStateCommitment. */
        public finalStateCommitment?: (primitives.IWord|null);

        /** TransactionHeader inputNotes. */
        public inputNotes: transaction.IInputNoteCommitment[];

        /** TransactionHeader outputNotes. */
        public outputNotes: note.INoteHeader[];

        /**
         * Creates a new TransactionHeader instance using the specified properties.
         * @param [properties] Properties to set
         * @returns TransactionHeader instance
         */
        public static create(properties?: transaction.ITransactionHeader): transaction.TransactionHeader;

        /**
         * Encodes the specified TransactionHeader message. Does not implicitly {@link transaction.TransactionHeader.verify|verify} messages.
         * @param message TransactionHeader message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: transaction.ITransactionHeader, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a TransactionHeader message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns TransactionHeader
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): transaction.TransactionHeader;

        /**
         * Creates a TransactionHeader message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns TransactionHeader
         */
        public static fromObject(object: { [k: string]: any }): transaction.TransactionHeader;

        /**
         * Creates a plain object from a TransactionHeader message. Also converts values to other types if specified.
         * @param message TransactionHeader
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: transaction.TransactionHeader, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this TransactionHeader to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for TransactionHeader
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}

/** Namespace blockchain. */
export namespace blockchain {

    /** Properties of a BlockNumber. */
    interface IBlockNumber {

        /** BlockNumber blockNum */
        blockNum?: (number|null);
    }

    /** Represents a BlockNumber. */
    class BlockNumber implements IBlockNumber {

        /**
         * Constructs a new BlockNumber.
         * @param [properties] Properties to set
         */
        constructor(properties?: blockchain.IBlockNumber);

        /** BlockNumber blockNum. */
        public blockNum: number;

        /**
         * Creates a new BlockNumber instance using the specified properties.
         * @param [properties] Properties to set
         * @returns BlockNumber instance
         */
        public static create(properties?: blockchain.IBlockNumber): blockchain.BlockNumber;

        /**
         * Encodes the specified BlockNumber message. Does not implicitly {@link blockchain.BlockNumber.verify|verify} messages.
         * @param message BlockNumber message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: blockchain.IBlockNumber, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a BlockNumber message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns BlockNumber
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): blockchain.BlockNumber;

        /**
         * Creates a BlockNumber message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns BlockNumber
         */
        public static fromObject(object: { [k: string]: any }): blockchain.BlockNumber;

        /**
         * Creates a plain object from a BlockNumber message. Also converts values to other types if specified.
         * @param message BlockNumber
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: blockchain.BlockNumber, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this BlockNumber to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for BlockNumber
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}

/** Namespace note. */
export namespace note {

    /** NoteType enum. */
    enum NoteType {
        NOTE_TYPE_UNSPECIFIED = 0,
        NOTE_TYPE_PRIVATE = 1,
        NOTE_TYPE_PUBLIC = 2
    }

    /** NoteVersion enum. */
    enum NoteVersion {
        NOTE_VERSION_UNSPECIFIED = 0,
        NOTE_VERSION_V1 = 1
    }

    /** Properties of a NoteId. */
    interface INoteId {

        /** NoteId id */
        id?: (primitives.IWord|null);
    }

    /** Represents a NoteId. */
    class NoteId implements INoteId {

        /**
         * Constructs a new NoteId.
         * @param [properties] Properties to set
         */
        constructor(properties?: note.INoteId);

        /** NoteId id. */
        public id?: (primitives.IWord|null);

        /**
         * Creates a new NoteId instance using the specified properties.
         * @param [properties] Properties to set
         * @returns NoteId instance
         */
        public static create(properties?: note.INoteId): note.NoteId;

        /**
         * Encodes the specified NoteId message. Does not implicitly {@link note.NoteId.verify|verify} messages.
         * @param message NoteId message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: note.INoteId, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a NoteId message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns NoteId
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): note.NoteId;

        /**
         * Creates a NoteId message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns NoteId
         */
        public static fromObject(object: { [k: string]: any }): note.NoteId;

        /**
         * Creates a plain object from a NoteId message. Also converts values to other types if specified.
         * @param message NoteId
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: note.NoteId, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this NoteId to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for NoteId
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a NoteMetadata. */
    interface INoteMetadata {

        /** NoteMetadata version */
        version?: (note.NoteVersion|null);

        /** NoteMetadata sender */
        sender?: (account.IAccountId|null);

        /** NoteMetadata noteType */
        noteType?: (note.NoteType|null);

        /** NoteMetadata tag */
        tag?: (number|null);

        /** NoteMetadata attachmentSchemes */
        attachmentSchemes?: (number[]|null);

        /** NoteMetadata attachmentsCommitment */
        attachmentsCommitment?: (primitives.IWord|null);
    }

    /** Represents a NoteMetadata. */
    class NoteMetadata implements INoteMetadata {

        /**
         * Constructs a new NoteMetadata.
         * @param [properties] Properties to set
         */
        constructor(properties?: note.INoteMetadata);

        /** NoteMetadata version. */
        public version: note.NoteVersion;

        /** NoteMetadata sender. */
        public sender?: (account.IAccountId|null);

        /** NoteMetadata noteType. */
        public noteType: note.NoteType;

        /** NoteMetadata tag. */
        public tag: number;

        /** NoteMetadata attachmentSchemes. */
        public attachmentSchemes: number[];

        /** NoteMetadata attachmentsCommitment. */
        public attachmentsCommitment?: (primitives.IWord|null);

        /**
         * Creates a new NoteMetadata instance using the specified properties.
         * @param [properties] Properties to set
         * @returns NoteMetadata instance
         */
        public static create(properties?: note.INoteMetadata): note.NoteMetadata;

        /**
         * Encodes the specified NoteMetadata message. Does not implicitly {@link note.NoteMetadata.verify|verify} messages.
         * @param message NoteMetadata message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: note.INoteMetadata, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a NoteMetadata message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns NoteMetadata
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): note.NoteMetadata;

        /**
         * Creates a NoteMetadata message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns NoteMetadata
         */
        public static fromObject(object: { [k: string]: any }): note.NoteMetadata;

        /**
         * Creates a plain object from a NoteMetadata message. Also converts values to other types if specified.
         * @param message NoteMetadata
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: note.NoteMetadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this NoteMetadata to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for NoteMetadata
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a NoteInclusionProof. */
    interface INoteInclusionProof {

        /** NoteInclusionProof noteId */
        noteId?: (note.INoteId|null);

        /** NoteInclusionProof blockNum */
        blockNum?: (blockchain.IBlockNumber|null);

        /** NoteInclusionProof noteIndexInBlock */
        noteIndexInBlock?: (number|null);

        /** NoteInclusionProof inclusionPath */
        inclusionPath?: (primitives.ISparseMerklePath|null);
    }

    /** Represents a NoteInclusionProof. */
    class NoteInclusionProof implements INoteInclusionProof {

        /**
         * Constructs a new NoteInclusionProof.
         * @param [properties] Properties to set
         */
        constructor(properties?: note.INoteInclusionProof);

        /** NoteInclusionProof noteId. */
        public noteId?: (note.INoteId|null);

        /** NoteInclusionProof blockNum. */
        public blockNum?: (blockchain.IBlockNumber|null);

        /** NoteInclusionProof noteIndexInBlock. */
        public noteIndexInBlock: number;

        /** NoteInclusionProof inclusionPath. */
        public inclusionPath?: (primitives.ISparseMerklePath|null);

        /**
         * Creates a new NoteInclusionProof instance using the specified properties.
         * @param [properties] Properties to set
         * @returns NoteInclusionProof instance
         */
        public static create(properties?: note.INoteInclusionProof): note.NoteInclusionProof;

        /**
         * Encodes the specified NoteInclusionProof message. Does not implicitly {@link note.NoteInclusionProof.verify|verify} messages.
         * @param message NoteInclusionProof message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: note.INoteInclusionProof, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a NoteInclusionProof message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns NoteInclusionProof
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): note.NoteInclusionProof;

        /**
         * Creates a NoteInclusionProof message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns NoteInclusionProof
         */
        public static fromObject(object: { [k: string]: any }): note.NoteInclusionProof;

        /**
         * Creates a plain object from a NoteInclusionProof message. Also converts values to other types if specified.
         * @param message NoteInclusionProof
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: note.NoteInclusionProof, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this NoteInclusionProof to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for NoteInclusionProof
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a NoteHeader. */
    interface INoteHeader {

        /** NoteHeader metadata */
        metadata?: (note.INoteMetadata|null);

        /** NoteHeader detailsCommitment */
        detailsCommitment?: (primitives.IWord|null);
    }

    /** Represents a NoteHeader. */
    class NoteHeader implements INoteHeader {

        /**
         * Constructs a new NoteHeader.
         * @param [properties] Properties to set
         */
        constructor(properties?: note.INoteHeader);

        /** NoteHeader metadata. */
        public metadata?: (note.INoteMetadata|null);

        /** NoteHeader detailsCommitment. */
        public detailsCommitment?: (primitives.IWord|null);

        /**
         * Creates a new NoteHeader instance using the specified properties.
         * @param [properties] Properties to set
         * @returns NoteHeader instance
         */
        public static create(properties?: note.INoteHeader): note.NoteHeader;

        /**
         * Encodes the specified NoteHeader message. Does not implicitly {@link note.NoteHeader.verify|verify} messages.
         * @param message NoteHeader message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: note.INoteHeader, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a NoteHeader message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns NoteHeader
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): note.NoteHeader;

        /**
         * Creates a NoteHeader message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns NoteHeader
         */
        public static fromObject(object: { [k: string]: any }): note.NoteHeader;

        /**
         * Creates a plain object from a NoteHeader message. Also converts values to other types if specified.
         * @param message NoteHeader
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: note.NoteHeader, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this NoteHeader to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for NoteHeader
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}
