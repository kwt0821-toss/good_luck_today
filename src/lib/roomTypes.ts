export type RoomCategory = "가구" | "소품" | "벽 꾸미기" | "바닥" | "카드액자";
export type RoomPlacementKind = "floor" | "floor-decal" | "wall" | "wallpaper" | "floor-skin";
export type RoomMode = "view" | "edit";
export type RoomTab = RoomCategory;
export type RoomOrientation = "default" | "mirrored";

export type FurnitureOrientation = {
  image: string;
  footprint: [number, number];
  anchorFootprintCenterPx: [number, number];
  anchorBackCornerPx?: [number, number];
  size: [number, number];
};

export type RoomItem = {
  id: string;
  nameKo: string;
  category: RoomCategory;
  footprint: [number, number] | null;
  placement: RoomPlacementKind;
  price: number;
  ownedDefault: boolean;
  placedDefault?: boolean;
  image: string | null;
  imageSizePx?: [number, number];
  tileImage: string | null;
  furniture?: {
    default: FurnitureOrientation;
    mirrored: FurnitureOrientation;
  };
  wallImages?: {
    front: string;
    left: string;
    right: string;
  };
  displayWidthTiles?: number;
  wallSpanTiles?: number;
  canSitOnSurface?: boolean;
  decal?: boolean;
  shadow?: string | null;
  hero?: boolean;
};

export type RoomCatalog = {
  items: RoomItem[];
};

export type FloorPlacement = {
  instanceId: string;
  id: string;
  col: number;
  row: number;
  orientation: RoomOrientation;
  onTopOf?: string;
  fx?: number;
  fy?: number;
};

export type WallPlacement = {
  instanceId: string;
  id: string;
  wall: "L" | "R";
  t: number;
  heightUnits: number;
  slot: number;
  band: number;
  worldPx?: [number, number];
};

export type RoomDrag =
  | { kind: "floor"; instanceId: string; col: number; row: number }
  | { kind: "wall"; instanceId: string; wall: "L" | "R"; slot: number; band: number };

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
  shadowsEnabled: boolean;
};

export type SpriteRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
};
