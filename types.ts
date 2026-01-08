
export enum GestureMode {
  DRAW = 'DRAW',
  SHAPE = 'SHAPE',
  SELECT = 'SELECT',
  ERASE = 'ERASE',
  CLEAR = 'CLEAR',
  IDLE = 'IDLE'
}

export interface Point {
  x: number;
  y: number;
}

export interface DrawingPath {
  points: Point[];
  color: string;
  width: number;
  isEraser: boolean;
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}
