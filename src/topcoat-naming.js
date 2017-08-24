import postcss from 'postcss';
import Mustache from 'mustache';
import TopdocParser from 'postcss-topdoc/lib/topdoc-parser';
import yaml from 'js-yaml';

/**
 *  Private: default function for creating CSS selector class names.
 *
 *  * `arguments`
 *    * `block` {String} Block element name
 *    * `modifier` (optional) {String} modifier name
 *    * `state` (optional) {String} state name.
 *
 *  ## Examples
 *
 *  ```js
 *  _defaultSelectorClassNaming({
 *    block: 'Button',
 *    modifier: 'secondary',
 *    state: ':disabled'
 *  }); //returns ".Button--secondary:disabled, .Button--secondary.is-disabled"
 *  ```
 *
 *  Returns {String} CSS selector
 */
function _defaultSelectorClassNaming({block, modifier = false, state = false}) {
  let result = `.${block}`;
  if(modifier) result += `--${modifier}`;
  if(state) {
    const stateRegex = /^:?(\w+)$/;
    const matches = state.match(stateRegex);
    const cleanStateName = matches[1];
    // has colon for dom states (i.e. :disabled)
    if((matches[1] != matches[0])) {
      result += `${state}, ${result}.is-${cleanStateName}`;
    } else {
      result += `.is-${cleanStateName}`;
    }
  }
  return result;
}
/**
 *  Private: default function for creating class names for use in Topdoc markup.
 *
 *  * `arguments`
 *    * `block` {String} Block element name
 *    * `modifier` (optional) {String} modifier name
 *    * `state` (optional) {String} state name.
 *
 *  ## Examples
 *
 *  ```js
 *  _defaultDomClassNaming({
 *    block: 'Button',
 *    modifier: 'secondary',
 *    state: ':disabled'
 *  }); //returns "Button--secondary is-disabled"
 *  ```
 *
 *  Returns {String} DOM class name.
 */
function _defaultDomClassNaming({block, modifier = false, state = false}) {
  let result = `${block}`;
  if(modifier) result += `--${modifier}`;
  if(state) {
    const stateRegex = /^:?(\w+)$/;
    const matches = state.match(stateRegex);
    const cleanStateName = matches[1];
    result += ` is-${cleanStateName}`;
  }
  return result;
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
    this.opts.selectorNaming = this.opts.selectorNaming || _defaultSelectorClassNaming;
    this.opts.domNaming = this.opts.domNaming || _defaultDomClassNaming;
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
    const newClassName = this.opts.selectorNaming({block: atRule.params, modifier: this.opts.modifier});
    const stateNames = [{blockName: this.opts.domNaming({block: atRule.params, modifier: this.opts.modifier})}];
    const newBlockClass = _convertAtRuleToRule(atRule, `${newClassName}{}`);
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
      const stateRuleSelector = this.opts.selectorNaming({block: atRule.params, modifier: this.opts.modifier, state: subAtRule.params});
      stateNames.push(
        { blockName: this.opts.domNaming({
          block: atRule.params,
          modifier: this.opts.modifier,
          state: subAtRule.params
        })
      });
      _outdent(newBlockClass.cloneAfter(_convertAtRuleToRule(subAtRule, stateRuleSelector)));
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
