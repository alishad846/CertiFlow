import { ElementType } from 'react';
import ShapeLayer from 'canva-editor/layers/ShapeLayer';
import TextLayer from 'canva-editor/layers/TextLayer';
import ImageLayer from 'canva-editor/layers/ImageLayer';
import GroupLayer from 'canva-editor/layers/GroupLayer';
import RootLayer from 'canva-editor/layers/RootLayer';
import LineLayer from 'canva-editor/layers/LineLayer';
import TableLayer from 'canva-editor/layers/TableLayer';

export const resolvers: Record<string, ElementType> = {
    RootLayer,
    ShapeLayer,
    TextLayer,
    ImageLayer,
    GroupLayer,
    LineLayer,
    TableLayer,
};
