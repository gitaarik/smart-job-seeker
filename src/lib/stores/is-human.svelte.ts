// Whether the user has been validated to be a human through Cloudflare Turnstile

let value = $state(false);

export const isHumanState = {
	get value() {
		return value;
	},
	set value(newValue: boolean) {
		value = newValue;
	}
};
