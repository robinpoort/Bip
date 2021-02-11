# Bip: Swipe support for CSS transitions.
Just write your CSS transitions, add a toggle button, optional transition buddies and initiate Bip. That’s it!

## Features
- Just write CSS transitions. No animating in JS needed.
- Values are calculated on start drag, so no miscalculation bugs on window resize.
- Add optional buddies to an element that transition with it.
- All elements move based on their delays en durations. So buddies can start and stop later depending on it’s delay and duration settings.

## Demo
[https://robinpoort.github.io/bip/](https://robinpoort.github.io/bip/)

## Default use

### Add your HTML

```html
<div class="target" data-touch-controllers=".control, .overlay" data-touch-buddies=".buddy">
    <button class="control" type="button">Swipe me</button>
    Swipeable area on target
    <div data-touch-ignore>
        Non-swipeable area on target. Swiping me will not do anything
    </div>
</div>
<div class="overlay">
    Swiping me can close the target
</div>
<div class="buddy">
    I will transition together with .target
</div>
```

### Make sure each "target", "controller" and "buddy" are transitioned using the 'is-open' class. Also make sure that the target has at least the "calculator styling" (default: translate) for both the default (closed) en open state.
```css
.target {
    transform: translateY(-50%);
    transition: transform 400ms;
}
.target.is-open {
    transform: translateY(0);
}
.overlay {
    opacity: 0;
    transition: opacity 300ms;
}
.overlay.is-open {
    opacity: 1;
}
.buddy {
    transform: scale(.6);
    opacity: .5;
    transition: transform 400ms, opacity 300ms 100ms;
}
.buddy.is-open {
    transform: scale(1);
    opacity: 1;
}
```

**Note:** If you want to transition things like width, height, top, left etc., make sure to add them to the `cssValues` option.

### Initialize
```html
<script src="src/js/bip.js"></script>
<script>const bip = new Bip('.target');</script>
```

## Acknowledgements
- Calculations are based on linear transitions, so swiping and clicking might look slightly different when using longer transition times combined with a non-linear bezier.
- CssValues should be single values, shorthand CSS is not supported.
- Translate is only calculated correctly when being set before rotate or skew.
- Using rotate and skew together doesn't currently work due to how browsers and Bip calculate the transform matrix.

## Options

### buddies
Data attribute name for buddies (default: `data-touch-buddies`)

### controllers
Data attribute name for controller(s) (default: `data-touch-controllers`)

### ignore
Data attribute name for ignore elements (default: `data-touch-ignore`)

### calculator
The property that is being used to calculate 'from' and 'to' of target element (default: `'translate'`).

### threshold
The "percentage" that the drag has to be at least occured before toggling the element. If not met, the element will reset itself on release. (default: `0.2`)

### difference
The amount of pixels that need to differ between the last state and current state to set the direction. For example; swiping down and releasing while accidentally swiping 4 pixels up because of releasing will still keep the direction set to "down". (default: `10`)
  
### maxEndDuration
The amount of milliseconds the final transition (when releasing) may take. (default: `500`)
  
### openClass
Class name for elements when open. (default: `'is-open'`)

### touchmoveClass: 
Class name for target element while dragging/swiping. (default: `'is-touchmove'`)

### transitioningClass
Class name for target element when transitioning (on release). (default: `'is-transitioning'`)

### matrixValues
Default matrix values to check. (default: `['translate', 'scale', 'rotate', 'skew']`)

### cssValues
Default CSS properties to check for. (default: `['opacity']`)

### yAxis
Calculator elements where the axis is always 'y'. (default: `['top', 'bottom', 'height', 'margin-top', 'margin-bottom', 'padding-top', 'padding-bottom']`)

### clickDrag
Enables clickdrag on none touch devices. (default: `true`)

### emitEvents
Wether to emit events or not. (default: `true`)

## Methods

### init
Initiates bip. Automatically called when creating new Bip. Init could be used programatically when Bip has been destroyed programatically.

```js
const bip = new Bip('[data-touch]');
bip.init();
```

### toggle
Toggles a target.

```js
const bip = new Bip('[data-touch]');
bip.toggle(document.querySelector('.selector'));
```

### destroy
Destroys bip

```js
const bip = new Bip('[data-touch]');
bip.destroy();
```

## Events

### bipInit
fired when initiated. Access to: settings, selectors

```js
document.addEventListener('bipInit', function (e) {
    console.log('bipInit', e.detail);
}, false);
```

### bipCalculateFrom
fired when target "from" values have been read. Access to: settings, target, fromValues

```js
document.addEventListener('bipInit', function (e) {
    console.log('bipCalculateFrom', e.detail);
}, false);
```

### bipCalculateTo
fired when target "to" values have been read. Access to: settings, target, fromValues, toValues

```js
document.addEventListener('bipCalculateTo', function (e) {
    console.log('bipCalculateFrom', e.detail);
}, false);
```

### bipStartDrag
fired when start swipe/drag. Access to: settings, target, targetValues, buddies

```js
document.addEventListener('bipStartDrag', function (e) {
    console.log('bipCalculateFrom', e.detail);
}, false);
```

### bipEndDrag
fired when end swipe/drag. Access to: settings, target, targetValues, buddies

```js
document.addEventListener('bipEndDrag', function (e) {
    console.log('bipCalculateFrom', e.detail);
}, false);
```

### bipEnd
fired when complete transition is done. Access to: settings, target, targetValues, buddies

```js
document.addEventListener('bipEnd', function (e) {
    console.log('bipCalculateFrom', e.detail);
}, false);
```
