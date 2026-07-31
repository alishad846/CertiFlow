import { ElementType } from 'react';
import RootLayer from '../layers/RootLayer';
import TextLayer from '../layers/TextLayer';
import ImageLayer from '../layers/ImageLayer';
import ShapeLayer from '../layers/ShapeLayer';
import FrameLayer from '../layers/FrameLayer';
import GroupLayer from '../layers/GroupLayer';
import LineLayer from '../layers/LineLayer';
import TableLayer from '../layers/TableLayer';

export const resolvers: Record<string, ElementType> = {
    RootLayer,
    TextLayer,
    ImageLayer,
    ShapeLayer,
    FrameLayer,
    GroupLayer,
    LineLayer,
    TableLayer,
};
