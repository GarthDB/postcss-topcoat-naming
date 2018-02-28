import postcss from 'postcss';
import TopcoatNaming from './topcoat-naming';

export default postcss.plugin('postcss-topcomponent',
  (opts = {}) =>
    (css, result) => {
      return new TopcoatNaming(css, result, opts)
    }
);
