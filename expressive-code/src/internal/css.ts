import {
  compile,
  serialize,
  stringify,
  middleware,
  type Element as StylisElement,
} from "stylis";
import { escapeRegExp } from "./escaping";

export const groupWrapperElement = "div";
export const groupWrapperClassName = "expressive-code";

/**
 * A map of long terms commonly found in style setting paths to shorter alternatives that are
 * still human-readable. These replacements are automatically applied by {@link getCssVarName}
 * when generating CSS variable names to keep them fairly short.
 *
 * Plugins can add their own replacements to this map by adding a `cssVarReplacements` property
 * to their {@link PluginStyleSettings} object.
 */
export const cssVarReplacements = new Map<string, string>([
  ["background", "bg"],
  ["foreground", "fg"],
  ["color", "col"],
  ["border", "brd"],
  ["padding", "pad"],
  ["margin", "marg"],
  ["radius", "rad"],
  ["opacity", "opa"],
  ["width", "wd"],
  ["height", "ht"],
  ["weight", "wg"],
  ["block", "blk"],
  ["inline", "inl"],
  ["bottom", "btm"],
  ["value", "val"],
  ["active", "act"],
  ["inactive", "inact"],
  ["highlight", "hl"],
  ["selection", "sel"],
  ["indicator", "ind"],
  ["shadow", "shd"],
  ["family", "fml"],
  ["transform", "trf"],
  ["decoration", "dec"],
  ["button", "btn"],
  ["editor", "ed"],
  ["terminal", "trm"],
  ["scrollbar", "sb"],
  ["toolbar", "tb"],
  ["gutter", "gtr"],
  ["titlebar", "ttb"],
  ["textMarkers", "tm"],
  ["frames", "frm"],
]);

const groupWrapperScope = `.${groupWrapperClassName}`;
const groupWrapperScopeEscaped = escapeRegExp(groupWrapperScope);
const regExpScopedTopLevel = new RegExp(
  `^${groupWrapperScopeEscaped}\\s+.*(${groupWrapperScopeEscaped}|:root|html|body)`,
  "g",
);

/**
 * Custom stylis middleware to handle scoping logic similarly to the original PostCSS plugins.
 */
function scopeMiddleware(element: StylisElement) {
  if (element.type === "rule" && element.props) {
    const scopeSelector = (selector: string) => {
      // Replace double scoping or root elements scoping:
      // `.expressive-code :root` -> `:root`
      // `.expressive-code .expressive-code` -> `.expressive-code`
      let resolved = selector.replace(regExpScopedTopLevel, "$1");

      // Prevent top-level selectors that are already scoped from being scoped twice
      // e.g. `.expressive-code .expressive-code-something` -> `.expressive-code-something`
      const doubleScopePrefix = `${groupWrapperScope} ${groupWrapperScope}`;
      if (resolved.startsWith(doubleScopePrefix)) {
        resolved = resolved.slice(groupWrapperScope.length).trim();
      }

      return resolved;
    };

    if (Array.isArray(element.props)) {
      element.props = element.props.map(scopeSelector);
    } else if (typeof element.props === "string") {
      element.props = scopeSelector(element.props);
    }
  }
}

export async function scopeAndMinifyNestedCss(css: string): Promise<string> {
  // Wrap the CSS in the scope selector. Stylis will handle nesting (unnesting) automatically.
  const compiled = compile(`${groupWrapperScope}{${css}}`);

  // stylis default stringify does minification by discarding whitespaces and comments.
  // We run our custom scopeMiddleware along with the built-in stringify middleware.
  const result = serialize(compiled, middleware([scopeMiddleware, stringify]));

  return result;
}

export type PluginStyles = { pluginName: string; styles: string };

const processedStylesCache = new Map<string, string>();

/**
 * Processes the CSS styles added by plugins:
 * - Deduplicates the styles.
 * - Ensures that all selectors are scoped, unless they target the root element, html or body.
 * - Minifies the CSS.
 */
export async function processPluginStyles(
  pluginStyles: PluginStyles[],
): Promise<Set<string>> {
  const result = new Set<string>();
  const seenStyles = new Set<string>();

  for (const { pluginName, styles } of pluginStyles) {
    // Deduplicate the current set of styles
    if (seenStyles.has(styles)) continue;
    seenStyles.add(styles);

    // Return cached result if the current styles have already been processed
    // in a previous call to this function with the same config class name
    const cacheKey = styles;
    const cachedStyles = processedStylesCache.get(cacheKey);
    if (cachedStyles !== undefined) {
      result.add(cachedStyles);
      continue;
    }

    try {
      // Scope the plugin styles to our group wrapper and minify them
      const processedCss = await scopeAndMinifyNestedCss(styles);
      // Add the processed styles to the result
      result.add(processedCss);
      // Cache the processed styles
      processedStylesCache.set(cacheKey, processedCss);
    } catch (error) {
      /* c8 ignore next */
      const msg = error instanceof Error ? error.message : (error as string);
      throw new Error(
        `Plugin "${pluginName}" added CSS styles that could not be processed (error=${JSON.stringify(msg)}). Styles="${styles}"`,
      );
    }
  }

  return result;
}

/**
 * If `cascadeLayerName` is a non-empty string, wraps the given `css` styles
 * into a `@layer` rule with the given name.
 */
export function wrapInCascadeLayer(
  css: string,
  cascadeLayerName: string | undefined,
) {
  if (!cascadeLayerName || cascadeLayerName.trim() === "") return css;
  return `@layer ${cascadeLayerName.trim()}{${css}}`;
}
