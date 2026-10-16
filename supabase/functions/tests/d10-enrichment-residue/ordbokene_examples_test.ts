import {assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  collectOrdbokeneArticleExamples,
  renderOrdbokeneContent,
} from '../../_shared/d10-ordbokene-examples.ts';

Deno.test('renders usage and article_ref placeholders', () => {
  assertEquals(renderOrdbokeneContent({
    content: 'han $ ofte $',
    items: [{type_: 'usage', text: 'er'}, {type_: 'article_ref', lemmas: [{lemma: 'hjemme'}]}],
  }), 'han er ofte hjemme');
});

Deno.test('skips a quote with an unknown placeholder', () => {
  assertEquals(renderOrdbokeneContent({content: 'det $ godt', items: [{type_: 'unknown'}]}), null);
});

Deno.test('collects own examples and ignores nested sub-articles', () => {
  const body = {
    definitions: [{
      type_: 'definition',
      elements: [
        {type_: 'example', quote: {content: 'være til for andre', items: []}},
        {type_: 'sub_article', article: {body: {definitions: [
          {type_: 'example', quote: {content: 'eksempel fra en annen artikkel', items: []}},
        ]}}},
      ],
    }],
  };
  assertEquals([...collectOrdbokeneArticleExamples(body)], ['være til for andre']);
});

Deno.test('ignores a plain-string quote shape', () => {
  assertEquals([...collectOrdbokeneArticleExamples({type_: 'example', quote: 'ikke struktur'})], []);
});
