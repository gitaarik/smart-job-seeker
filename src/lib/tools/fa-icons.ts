import * as icons from '@fortawesome/free-solid-svg-icons';

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
  return (icons as Record<string, any>)[key];
}
