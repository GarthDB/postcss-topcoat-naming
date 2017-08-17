import postcss from 'postcss';
import TopcoatNaming from './topcoat-naming';

export default postcss.plugin('postcss-topcoat-naming',
  (opts = {}) =>
    (css) =>
      new TopcoatNaming(css, opts)
);
