# postcss-topcoat-naming [![Build Status](https://travis-ci.org/GarthDB/postcss-topcoat-naming.svg?branch=master)](https://travis-ci.org/GarthDB/postcss-topcoat-naming)
A PostCSS plugin to collapse BEM @rules and corresponding Topdoc comments

```css
@block menu {
  color: #333;
  @state open {
    opacity: 0.1;
  }
  @modifier secondary {
    color: #666;
  }
}
```

is collapsed to this:

```css
.menu--secondary {
  color: #333;
  color: #666;
}
.menu--secondary.is-open {
  opacity: 0.1;
}
```
