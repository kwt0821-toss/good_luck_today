export type RoomCategory = "가구" | "소품" | "벽지" | "바닥" | "카드액자";
export type RoomPlacementKind = "floor" | "wall" | "wallpaper" | "floor-skin";
export type RoomMode = "view" | "edit";
export type RoomTab = RoomCategory;

export type RoomItem = {
  id: string;
  nameKo: string;
  category: RoomCategory;
  footprint: [number, number] | null;
  placement: RoomPlacementKind;
  wall?: "L" | "R";
  price: number;
  ownedDefault: boolean;
  image: string | null;
  imagePng?: string | null;
  tileImage: string | null;
  spriteWorldPx?: [number, number];
  anchorOffsetWorldPx?: [number, number];
  wallPosWorldPx?: [number, number];
  glow?: string;
  layer?: "decal";
  stackable?: boolean;
};

export type RoomCatalog = {
  items: RoomItem[];
};

export type FloorPlacement = {
  instanceId: string;
  id: string;
  col: number;
  row: number;
  rot: 0 | 1;
  flip: boolean;
};

export type WallPlacement = {
  instanceId: string;
  id: string;
  wall: "L" | "R";
  slot: number;
  span: number;
  worldPx: [number, number];
};

export type RoomLayoutState = {
  floor: FloorPlacement[];
  walls: WallPlacement[];
  wallpaper: string;
  floorSkin: string;
};

export type RoomSaveState = {
  points: number;
  owned: Record<string, number>;
  layout: RoomLayoutState;
  cozyLevel: number;
};

export type DragPreview = {
  instanceId: string;
  col: number;
  row: number;
  valid: boolean;
};
