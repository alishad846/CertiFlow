import { describe, it, expect } from 'vitest';
import { mergeEditorDocument } from '../editor-render';

describe('mergeEditorDocument', () => {
  it('replaces tokens in text layers (readable shape)', () => {
    const design = {
      pages: [{ layers: { a: { type: 'Text', props: { text: 'Hi {{recipient_name}}' } } } }]
    };
    const out: any = mergeEditorDocument(design, { recipient_name: 'Asha' });
    expect(out.pages[0].layers.a.props.text).toBe('Hi Asha');
  });

  it('replaces tokens in the packed (minified) editor_document shape stored in the DB', () => {
    // Real designs are stored packed: text lives under layer.g.v (props.text).
    const design = [
      {
        a: '',
        b: '',
        c: {
          d: { e: { f: 'RootLayer' }, g: { o: 'rgb(255,255,255)' }, s: ['t1'], t: null },
          t1: {
            e: { f: 'TextLayer' },
            g: { v: '<p>{{recipient_name}}</p>', ab: ['rgb(0,0,0)'] },
            s: [],
            t: 'd'
          }
        }
      }
    ];
    const out: any = mergeEditorDocument(design, { recipient_name: 'Asha Verma' });
    expect(out[0].c.t1.g.v).toBe('<p>Asha Verma</p>');
  });

  it('does not mutate the input design', () => {
    const design = { pages: [{ layers: { a: { props: { text: '{{name}}' } } } }] };
    const clone = JSON.parse(JSON.stringify(design));
    mergeEditorDocument(design, { name: 'Ravi' });
    expect(design).toEqual(clone);
  });

  it('leaves strings without tokens untouched and resolves multiple tokens', () => {
    const out: any = mergeEditorDocument(
      { text: 'plain', greet: '{{name}} — {{course}}' },
      { name: 'Sam', course: 'Physics' }
    );
    expect(out.text).toBe('plain');
    expect(out.greet).toBe('Sam — Physics');
  });
});
