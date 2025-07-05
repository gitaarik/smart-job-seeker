<script lang="ts">
  import { track } from "$lib/tools/analytics";

  let classNames: string = "";
  export { classNames as class };

  let clickStylesLeft: string = "";
  let clickStylesRight: string = "";
  let mouseEnterLeftTime: number = 0;
  let mouseEnterRightTime: number = 0;

  function handleClickLogoLeft() {
    clickStylesLeft = "scale-105 -translate-15 brightness-125";
    trackLogoAnimateLeft();
    setTimeout(() => clickStylesLeft = "", 500);
  }

  function handleClickLogoRight() {
    clickStylesRight = "scale-105 -translate-15 brightness-125";
    trackLogoAnimateRight();
    setTimeout(() => clickStylesRight = "", 500);
  }

  function handleMouseEnterLogoLeft() {
    mouseEnterLeftTime = +(new Date());
  }

  function handleMouseEnterLogoRight() {
    mouseEnterRightTime = +(new Date());
  }

  function handleMouseLeaveLogoLeft() {
    if (+(new Date()) - mouseEnterLeftTime > 500) {
      trackLogoAnimateLeft();
    }
  }

  function handleMouseLeaveLogoRight() {
    if (+(new Date()) - mouseEnterRightTime > 500) {
      trackLogoAnimateRight();
    }
  }

  function trackLogoAnimateLeft() {
    track("LogoAnimateLeft");
  }

  function trackLogoAnimateRight() {
    track("LogoAnimateRight");
  }
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="-200 0 2559.5601 1568.96"
  fill="var(--bright-color, currentColor)"
  class={classNames}
>
  <g transform="translate(-101.76 -135.84)">
    <g transform="translate(-169.65 163.8)">
      <path
        on:click={handleClickLogoLeft}
        on:mouseenter={handleMouseEnterLogoLeft}
        on:mouseleave={handleMouseLeaveLogoLeft}
        aria-hidden="true"
        class="scale-100 hover:scale-105 hover:-translate-15 hover:brightness-125 transition duration-500 {clickStylesLeft}"
        transform="matrix(.13333 0 0 -.13333 0 5333.3)"
        d="m7317.4 31709h-1617.8l-2059.2 3567.1 2059.2 3567.2h1617.8l-2060-3567.2zm-2435.3 8500.5-2555.9-4429.4-290.7-504 290.7-503.2 2548.5-4415.6h3060.7l1331.3 3803.3 2117 6048.9h-6501.6"
      >
      </path>
      <path
        on:click={handleClickLogoRight}
        on:mouseenter={handleMouseEnterLogoRight}
        on:mouseleave={handleMouseLeaveLogoRight}
        aria-hidden="true"
        class="scale-100 hover:scale-105 hover:-translate-15 hover:brightness-125 transition duration-500 {clickStylesRight}"
        transform="matrix(.13333 0 0 -.13333 0 5333.3)"
        d="m14568 29809h-1617.9l2060 3567.2-2060 3567.1h1617.9l2058.4-3567.1zm3373.3 4069.6-2548.5 4416.4h-3060.7l-1331.3-3803.3-2117-6048.9h6500.9l2556.6 4429.4 290.7 504-290.7 502.4"
      >
      </path>
    </g>
  </g>
</svg>
