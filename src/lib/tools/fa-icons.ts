import * as solid from '@fortawesome/free-solid-svg-icons';
import * as brands from "@fortawesome/free-brands-svg-icons";
import * as regular from "@fortawesome/free-regular-svg-icons";

export function getFaIcon(iconName: string) {
  // Convert snake-case to camelCase
  const camelCase = iconName
    .split('-')
    .map((word, index) => {
      if (index === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');

  const key = `fa${camelCase.charAt(0).toUpperCase() + camelCase.slice(1)}`;
  const icons = {...solid, ...brands, ...regular};
  return (icons as Record<string, any>)[key];
}
