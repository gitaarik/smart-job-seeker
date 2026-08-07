import { existsSync, readFileSync } from 'fs';

export function isRunningInDocker() {
	// Method 1: Check for .dockerenv file (most reliable)
	if (existsSync('/.dockerenv')) {
		return true;
	}

	// Method 2: Check cgroup for docker/kubepods
	try {
		const cgroup = readFileSync('/proc/1/cgroup', 'utf8');
		if (/docker|kubepods/.test(cgroup)) {
			return true;
		}
	} catch {
		// File doesn't exist or not readable
	}

	// Method 3: Check for Docker-specific environment variable
	if (process.env.DOCKER_CONTAINER === 'true') {
		return true;
	}

	return false;
}
