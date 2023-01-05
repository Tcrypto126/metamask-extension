import { SIZES } from '../../../helpers/constants/design-system';

/**
 * The ICON_NAMES object contains all the possible icon names.
 *
 * Search for an icon: https://metamask.github.io/metamask-storybook/?path=/story/ui-components-component-library-icon-icon-stories-js--default-story
 *
 * Add an icon: https://metamask.github.io/metamask-storybook/?path=/docs/ui-components-component-library-icon-icon-stories-js--default-story#adding-a-new-icon
 *
 * ICON_NAMES is generated using svgs in app/images/icons and
 * the generateIconNames script in development/generate-icon-names.js
 * then stored as an environment variable
 */

/* eslint-disable prefer-destructuring*/ // process.env is not a standard JavaScript object, so we are not able to use object destructuring
export const ICON_NAMES = JSON.parse(process.env.ICON_NAMES);
export const ICON_SIZES = {
  XXS: SIZES.XXS,
  XS: SIZES.XS,
  SM: SIZES.SM,
  MD: SIZES.MD,
  LG: SIZES.LG,
  XL: SIZES.XL,
  AUTO: SIZES.AUTO,
};
