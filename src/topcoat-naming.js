import postcss from 'postcss';
import Mustache from 'mustache';
import TopdocParser from 'postcss-topdoc/lib/topdoc-parser';
import yaml from 'js-yaml';

/**
 *  Private: converts class name selector to a DOM class string
 *
 *  * `classSelector` {String} string with '.' syntax
 *
 *  ## Examples
 *
 *  ```js
 *  _classSelectorToDomClass('.a-class.b-class'); // returns 'a-class b-class'
 *  ```
 *
 *  Returns {String} removes '.' and adds space between class names.
 */
function _classSelectorToDomClass(classSelector) {
  return classSelector.split('.').join(' ').trim();
}
/**
 *  Private: gets a corresponding topdoc comment
 *
 *  * `topdoc` {TopDocument} containing component
 *  * `loc` {Object} line and column of the topdoc component comment end.
 *
 *  Returns {undefined} if no corresponding topdoc component is found.
 *  Returns {TopComponent} if found.
 */
function _getCorrespondingTopdocComponent(topdoc, loc) {
  return topdoc.components.find((component) => {
    return (component.commentEnd.line == loc.line && component.commentEnd.column == loc.column);
  });
}
/**
 *  Private: converts {AtRule} and child nodes to a {Rule} with a new selector.
 *
 *  * `atRule` {AtRule} postcss at rule
 *  * `selector` {String} css selector
 *
 *  Returns {Rule} with all the AtRule child nodes.
 */
function _convertAtRuleToRule(atRule, selector) {
  const root = postcss.parse(`${selector}{}`);
  root.first.raws = atRule.raws;
  root.first.nodes = atRule.nodes;
  root.first.raws.semicolon = true;
  return root.first.remove();
}
/**
 *  Private: outdents rule (moves an indented rule out)
 *
 *  * `rule` {Rule} or {AtRule} that needs to be outdented
 *  * `degree` (optional) {Int} Number of indents to be removed.
 *
 *  Returns the same {Rule} with the outdents applied.
 */
export function _outdent(rule, degree = 1) {
  const regex = new RegExp(`(  |\t){${degree}}`);
  rule.walk((child) => {
    if(child.raws.after) {
      child.raws.after = child.raws.after.replace(regex, '')
    }
    child.raws.before = child.raws.before.replace(regex, '')
  });
  if(rule.raws.after) {
    rule.raws.after = rule.raws.after.replace(regex, '')
  }
  if(rule.raws.before) {
    rule.raws.before = rule.raws.before.replace(regex, '')
  }
  return rule;
}

/**
 *  Private: takes a class name and modifier to build new class name for css selector.
 *
 *  * `className` {String} the block name
 *  * `modifier` (optional) {String} the modifier to append if present
 *
 *  Returns a {String} of the built class name (with prepended .)
 */
function _buildClassName(className, modifier = '') {
  if(modifier !== '') {
    return `${className}--${modifier}`;
  }
  return className;
}
const stateTemplate = '.{{className}}.is-{{stateName}}';
/**
 *  Private: adds state to class name
 *
 *  * `className` {String} block class name
 *  * `stateName` {String} state name to append
 *
 *  Returns {String} combined class name.
 */
function _buildStateClassName(className, stateName) {
  return Mustache.render(stateTemplate, {className, stateName: stateName.replace(':','')});
}
/**
 *  Private: adds state to class name
 *
 *  * `className` {String} name to append the state.
 *  * `stateName` {String} state name to be appended to class.
 *
 *  ## Examples
 *
 *  ```js
 *  _buildStateRule('.button', ':hover');
 *  //returns '.button:hover, .button.is-hover{}'
 *  ```
 *
 *  ```js
 *  _buildStateRule('.menu', 'open');
 *  //returns '.menu.is-open{}'
 *  ```
 *
 *  Returns a {String} of the complete selector
 */
function _buildStateRule(className, stateName) {
  const stateRegex = /^:?(\w+)$/;
  const matches = stateName.match(stateRegex);
  const newStateName = matches[1];
  const stateClassName = _buildStateClassName(className, newStateName);
  // has colon for dom states (i.e. :disabled)
  if((matches[1] != matches[0])) {
    return `.${className}${stateName}, ${stateClassName}{}`;
  }
  return `${stateClassName}{}`;
}
/**
 *  Private: converts state {AtRule} into a {Rule} with correct classname and state selector.
 *
 *  * `stateRule` {AtRule} (i.e. @state :hover {})
 *  * `parentClass` {String} class name of block parent
 *
 *  Returns {Rule}
 */
function _processStateRule(stateRule, parentClass) {
  const newSelector = postcss.parse(_buildStateRule(parentClass, stateRule.params));
  return _convertAtRuleToRule(stateRule, newSelector);
}

export default class TopcoatNaming {
  /**
   *  Public: TopcoatNaming constructor
   *
   *  * `css` {Root} from PostCSS parser
   *  * `result` {Result} from PostCSS
   *  * `opts` {Object} options
   *
   *  ## Examples
   *
   *  ```js
   *  export default postcss.plugin('postcss-topcoat-naming',
   *    (opts = {}) =>
   *      (css) =>
   *        new TopcoatNaming(css, opts)
   *  );
   *  ```
   */
  constructor(css, result, opts) {
    this.opts = opts;
    this.css = css;
    this.result = result;
    const topdocParser = new TopdocParser(css, result, {});
    this.topdoc = topdocParser.topdoc;
    this.css.walkAtRules('block', (rule) => this.processBlockRule(rule));
  }
  /**
   *  Private: processes block {AtRule}
   *
   *  * `atRule` {AtRule} with a name of 'block';
   */
  processBlockRule (atRule) {
    let modifierTopComponent;
    const topComment = (atRule.prev());
    const topComponent = (topComment) ? _getCorrespondingTopdocComponent(this.topdoc, atRule.prev().source.end): undefined;
    const newClassName = _buildClassName(atRule.params, this.opts.modifier);
    const stateNames = [{blockName: newClassName}];
    const newBlockClass = _convertAtRuleToRule(atRule, `.${newClassName}{}`);
    atRule.replaceWith(newBlockClass);
    newBlockClass.walkAtRules('modifier', (modifierAtRule) => {
      if(modifierAtRule.params === this.opts.modifier) {
        _outdent(modifierAtRule);
        modifierTopComponent = _getCorrespondingTopdocComponent(this.topdoc, modifierAtRule.prev().source.end);
        modifierAtRule.each((childNode) => {
          if(childNode.type === 'atrule' && childNode.name === 'state') {
            let matchFlag = false;
            newBlockClass.walkAtRules('state', (stateAtRule) => {
              if(stateAtRule.parent === atRule) {
                if(stateAtRule.params === childNode.params) {
                  childNode.each((grandChildNode) => {
                    stateAtRule.append(grandChildNode);
                    matchFlag = true;
                  });
                }
              }
            });
            if(!matchFlag){
              newBlockClass.prepend(childNode);
            }
          } else {
            newBlockClass.append(childNode);
          }
        });
      }
      if(_getCorrespondingTopdocComponent(this.topdoc, modifierAtRule.prev().source.end)) {
        modifierAtRule.prev().remove();
      }
      modifierAtRule.remove();
    });
    newBlockClass.walkAtRules('state', (subAtRule) => {
      stateNames.push({blockName: _classSelectorToDomClass(_buildStateClassName(newClassName, subAtRule.params))});
      _outdent(newBlockClass.cloneAfter(_processStateRule(subAtRule, newClassName)));
      subAtRule.remove();
    });
    if (topComponent) {
      Object.assign(topComponent, modifierTopComponent);
      const cleanComponent = Object.keys(topComponent).reduce((component, componentKey) => {
        if (componentKey === 'markup') {
          component[componentKey] = Mustache.render(topComponent.markup, {state: stateNames});
        } else if (componentKey !== 'commentStart' && componentKey !== 'commentEnd' && componentKey !== 'css') {
          component[componentKey] = topComponent[componentKey];
        }
        return component
      }, {});
      // console.log(cleanComponent);
      const yamlString = yaml.safeDump(cleanComponent);
      const newComment = postcss.parse(`/* topdoc
${yamlString.trim()}
*/`);
      // console.log(newComment.first.toString());
      topComment.replaceWith(newComment.first);
    }
  }
}
