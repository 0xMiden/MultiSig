// Note-related types
export interface Note {
  note_id: string;
  note_type: string;
  sender: string;
  tag: string;
  num_assets: number;
  status: string;
  created_at?: string;
}

export interface ConsumableNote extends Note {
  assets: NoteAsset[];
  inclusion_proof?: string;
}

export interface NoteAsset {
  asset_id: string;
  amount: string;
}

export interface NoteIdData {
  note_id: string;
  note_id_file_bytes: string;
}

export interface GetConsumableNotesResponse {
  notes: ConsumableNote[];
}

