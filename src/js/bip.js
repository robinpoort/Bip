(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], function () {
      return factory(root);
    });
  } else if (typeof exports === 'object') {
    module.exports = factory(root);
  } else {
    root.Bip = factory(root);
  }
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this, function (window) {

  'use strict';


  // Feature Test
  // ============

  var supports = 'querySelector' in document && 'addEventListener' in window;


  // Default variables
  // =================
  var defaults = {

    selector: '[data-touch]',
    controls: '[data-touch-controls]',
    closes: '[data-touch-closes]',
    calculator: 'translate',

    threshold: 0.2,
    openClass: 'is-open',
    transitioningClass: 'is-transitioning',
    touchmoveClass: 'is-touchmove',

    matrixValues: ['translate', 'scale', 'rotate', 'skew'],
    cssValues: ['opacity'],

    emitEvents: true
  };

  let touchstart = false;
  let touchstartX = 0;
  let touchstartY = 0;
  let touchendX = 0;
  let touchendY = 0;
  let lastDifference = false;
  let moveDirection = 'forward';
  let gestureZones = false;
  let target = false;
  let targetValues = [];
  let buddies = [];
  let buddiesValues = [];
  let ignore = false;
  let programmaticallyClosed = false;


  // Closest polyfill
  // ================

  /**
   * Element.closest() polyfill
   * https://developer.mozilla.org/en-US/docs/Web/API/Element/closest#Polyfill
   */
  if (!Element.prototype.closest) {
    if (!Element.prototype.matches) {
      Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
    }
    Element.prototype.closest = function (s) {
      var el = this;
      var ancestor = this;
      if (!document.documentElement.contains(el)) return null;
      do {
        if (ancestor.matches(s)) return ancestor;
        ancestor = ancestor.parentElement;
      } while (ancestor !== null);
      return null;
    };
  }


  // Emit event
  // ==========

  function emitEvent(type, settings, details) {
    if (typeof window.CustomEvent !== 'function') return;
    var event = new CustomEvent(type, {
      bubbles: true,
      detail: details,
      settings: settings
    });
    document.dispatchEvent(event);
  }


  // Extend
  // ======

  function extend() {

    // Variables
    let extended = {};
    let deep = false;
    let i = 0;

    // Check if a deep merge
    if (Object.prototype.toString.call(arguments[0]) === '[object Boolean]') {
      deep = arguments[0];
      i++;
    }

    // Merge the object into the extended object
    let merge = function (obj) {
      for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
          // If property is an object, merge properties
          if (deep && Object.prototype.toString.call(obj[prop]) === '[object Object]') {
            extended[prop] = extend(extended[prop], obj[prop]);
          } else {
            extended[prop] = obj[prop];
          }
        }
      }
    };

    // Loop through each object and conduct a merge
    for (; i < arguments.length; i++) {
      let obj = arguments[i];
      merge(obj);
    }

    return extended;

  }


  // See if number is between two values
  // ===================================

  Number.prototype.between = function (a, b, inclusive) {
    let min = Math.min(a, b);
    let max = Math.max(a, b);
    return inclusive ? this >= min && this <= max : this > min && this < max;
  };


  // Get matrix values
  // =================

  function getMatrixValues(element, type) {
    const style = window.getComputedStyle(element);
    const matrix = style['transform'] || style.webkitTransform || style.mozTransform;

    // Return false if no matrix is set
    if (matrix === 'none') return false;

    let value = {};

    // Thanks https://stackoverflow.com/questions/5107134/find-the-rotation-and-skew-of-a-matrix-transformation
    var calculateMatrixValues = function(a) {
      var angle = Math.atan2(a[1], a[0]),
          denom = Math.pow(a[0], 2) + Math.pow(a[1], 2),
          scaleX = Math.sqrt(denom),
          scaleY = (a[0] * a[3] - a[2] * a[1]) / scaleX || 1,
          skewX = Math.atan2(a[0] * a[2] + a[1] * a[3], denom);
      return {
        angle: angle / (Math.PI / 180),
        scaleX: scaleX,
        scaleY: scaleY,
        skewX: skewX / (Math.PI / 180),
        skewY: 0,
        translateX: a[4],
        translateY: a[5]
      };
    };

    const matrixValues = calculateMatrixValues(matrix.match(/matrix.*\((.+)\)/)[1].split(', '));

    // Set proper values
    if (type === 'translate') {
      value.value = {
        x: matrixValues.translateX,
        y: matrixValues.translateY,
        unit: 'px'
      }
    } else if (type === 'scale') {
      value.value = {
        x: matrixValues.scaleX,
        y: matrixValues.scaleY,
        unit: ''
      }
    } else if (type === 'rotate') {
      value.value = {
        x: matrixValues.angle,
        unit: 'deg'
      }
    } else if (type === 'skew') {
      value.value = {
        x: matrixValues.skewX,
        y: matrixValues.skewY,
        unit: 'deg'
      }
    }

    // Set delay and duration
    element.removeAttribute('style');
    value.delay = getTransitionValue('transitionDelay', style, 'transform');
    value.duration = getTransitionValue('transitionDuration', style, 'transform');
    element.style.transition = 'none';

    return value;
  }


  // Get CSS values
  // ==============

  function getCSSValue(element, type) {
    let style = window.getComputedStyle(element);
    let styles = [];
    styles.value = parseFloat(style[type]);
    styles.unit = style[type].replace(/\d+|[.]/g, '');
    element.removeAttribute('style');
    styles.delay = getTransitionValue('transitionDelay', style, type);
    styles.duration = getTransitionValue('transitionDuration', style, type);
    element.style.transition = 'none';
    return styles;
  }


  // Get transition value
  // ====================

  function getTransitionValue(prop, style, type) {
    let transition = style.transition;
    let transitionValues = style[prop].split(', ');
    let value = 0;
    transition.split(', ').forEach(function(el, i) {
      if (el.includes(type)) {
        value = parseFloat(transitionValues[i]) * 1000;
      }
    });
    return value;
  }


  // Get difference
  // ==============

  function getDifference(a, b) {
    return Math.abs(a - b)
  }


  // Calculate difference
  // ====================

  function calculateDifference(from, to, difference) {
    let values = {};
    values.difference = (getDifference(from, to)) || 0;
    return values;
  }


  // Is equivalent
  // =============

  function isEquivalent(a, b) {
    // Create arrays of property names
    var aProps = Object.getOwnPropertyNames(a);
    var bProps = Object.getOwnPropertyNames(b);

    // If number of properties is different,
    // objects are not equivalent
    if (aProps.length !== bProps.length) {
      return false;
    }

    for (var i = 0; i < aProps.length; i++) {
      var propName = aProps[i];

      // If values of same property are not equal,
      // objects are not equivalent
      if (a[propName] !== b[propName]) {
        return false;
      }
    }

    // If we made it this far, objects
    // are considered equivalent
    return true;
  }


  // Get calculations
  // ================

  function getCalculations(from, to, difference, dimension) {
    // Set values
    let values = {
      "from": from.value || '',
      "to": to.value || '',
      "unit": to.unit || '',
      "dir": (from.value < to.value) ? 'up' : 'down',
      "difference": calculateDifference(from.value, to.value, difference).difference,
      "delay": to.delay !== 0 ? to.delay : from.delay,
      "duration": to.duration !== 0 ? to.duration : from.duration
    };
    if (dimension === 2) {
      values.unit = to.value.unit;
      values.dir = (from.value.x < to.value.x) ? 'up' : 'down';
      values.difference = calculateDifference(from.value.x, to.value.x, difference).difference;
      values.ydir = (from.value.y < to.value.y) ? 'up' : 'down';
      values.ydifference = calculateDifference(from.value.y, to.value.y, difference).difference;
    }
    if (values.difference === 0 && values.ydifference === 0) return false;
    return values;
  }


  // Get transition values
  // =====================

  function getTransitionValues(element, calculator, settings) {

    // Variables
    let fromValues = {};
    let toValues = {};
    let returnValues = {
      "element": element
    };

    // Get initial values
    const calculateFrom = getMatrixValues(calculator, settings.calculator);
    settings.matrixValues.forEach(function(prop) { fromValues[prop] = (getMatrixValues(element, prop)) });
    settings.cssValues.forEach(function(prop) { fromValues[prop] = (getCSSValue(element, prop)) });

    // No transition styling
    calculator.style.transition = 'none';
    element.style.transition = 'none';

    // Get calculator value
    calculator.classList.toggle(settings.openClass);
    const calculateTo = getMatrixValues(calculator, "translate");
    calculator.classList.toggle(settings.openClass);

    // Get target values
    element.classList.toggle(settings.openClass);
    settings.matrixValues.forEach(function(prop) { toValues[prop] = (getMatrixValues(element, prop)) });
    settings.cssValues.forEach(function(prop) { toValues[prop] = (getCSSValue(element, prop)) });
    element.classList.toggle(settings.openClass);

    // X or Y
    const axis = (parseInt(calculateFrom.value.x, 10) !== parseInt(calculateTo.value.x, 10)) ? 'x' : 'y';
    const from = (axis === 'x') ? calculateFrom.value.x : calculateFrom.value.y;
    const to = (axis === 'x') ? calculateTo.value.x : calculateTo.value.y;
    const difference = getDifference(from, to);

    // Set element and axis for object
    if (element === target) {
      returnValues.axis = axis;
      returnValues.difference = difference;
    }

    // Add properties and values to the object
    settings.matrixValues.forEach(function(el) {
      if (fromValues[el] && toValues[el] && !isEquivalent(fromValues[el], toValues[el])) {
        const elCalculations = getCalculations(fromValues[el], toValues[el], difference, 2);
        if (elCalculations) {
          returnValues[el] = elCalculations
        }
      }
    });
    settings.cssValues.forEach(function(el) {
      if (!isEquivalent(fromValues[el], toValues[el])) {
        const elCalculations = getCalculations(fromValues[el], toValues[el], difference, 1)
        if (elCalculations) {
          returnValues[el] = elCalculations
        }
      }
    });

    return returnValues;
  }


  // Get target
  // ==========

  function getTarget(element, settings) {
    // See if element is either a controller or closing element
    const isControllerEl = element.getAttribute('data-touch-controls') || false;
    let isClosingEl = element.getAttribute('data-touch-closes') || false;

    // When element is a closing element
    if (isClosingEl) {
      let controllerList = [];
      isClosingEl = isClosingEl.split(',');
      isClosingEl.forEach(function (controller) {
        controller = document.querySelector('[data-touch-id="' + controller + '"]');
        if (controller.classList.contains(settings.openClass)) {
          controllerList.push(controller);
        }
      });
      if (controllerList.length === 1) {
        target = controllerList[0];
      } else {
        target = false;
      }
    } else {
      target = isControllerEl ? document.querySelector('[data-touch-id="' + isControllerEl + '"]') : element;
    }

    if (target) {
      buddies = getBuddies(target, element) || false;
    } else {
      document.querySelectorAll('[data-touch]').forEach(function(el) {
        if (el.classList.contains(settings.openClass)) {
          // Reset buddies and toggle elements
          buddies = [];
          toggle(el, settings);
        }
      });
      programmaticallyClosed = true;
    }

    return target;
  }


  // Get buddies
  // ===========

  function getBuddies(target) {

    // Get target buddies list
    let buddylist = target.getAttribute('data-touch-buddies') || false;

    // @TODO: fix this properly, we want the main target tpo be just another "buddy" (rename buddies)
    buddies.push(target);

    // When target has buddies
    if (buddylist) {
      buddylist = buddylist.split(',');
      buddylist.forEach(function (buddy) {
        buddy = document.querySelector('[data-touch-id="' + buddy + '"]');
        if (buddy) {
          buddies.push(buddy);
        }
      });
    }

    return buddies;
  }


  // Get values
  // ==========

  function getValues(target, settings) {
    const transitionValues = getTransitionValues(target, target, settings);
    const from = parseInt(transitionValues.axis === 'x' ? transitionValues.translate.from.x : transitionValues.translate.from.y);
    const to = parseInt(transitionValues.axis === 'x' ? transitionValues.translate.to.x : transitionValues.translate.to.y);


    return {
      "axis": transitionValues.axis,
      "from": from,
      "to": to,
      "difference": getDifference(from, to),
      "delay": transitionValues.translate.delay,
      "duration": transitionValues.translate.duration,
    };
  }


  // Calculate multiplier
  // ====================

  function calculateMultiplier(value) {
    let targetDuration = targetValues.duration;
    let factor = (targetValues.axis === 'x' ? (targetValues.movedX / (targetValues.difference / 100)) : (targetValues.movedY / (targetValues.difference / 100))) / 100;
    let delay = parseInt(value.delay === 0 ? targetValues.delay : value.delay);
    let duration = parseInt(value.duration === 0 ? targetValues.duration : value.duration);
    let delayFactor = delay/targetDuration;
    let durationFactor = duration/targetDuration;
    let X = (factor-delayFactor)*((targetDuration/(duration*durationFactor))*durationFactor);
    X = Math.max(0, Math.min(1, X));
    return X;
  }


  // Set buddy styling
  // =================

  function setStyling(element, buddyValues, settings) {
    let transforms = [];
    settings.matrixValues.forEach(function(prop) {
      if (buddyValues[prop] !== undefined) {
        let multiplier = calculateMultiplier(buddyValues[prop]);
        if (multiplier) {
          let x = (parseFloat(buddyValues[prop].from.x) < parseFloat(buddyValues[prop].to.x)) ? parseFloat(buddyValues[prop].from.x) + (buddyValues[prop].difference * multiplier) : parseFloat(buddyValues[prop].from.x) - (buddyValues[prop].difference * multiplier);
          let y = (parseFloat(buddyValues[prop].from.y) < parseFloat(buddyValues[prop].to.y)) ? parseFloat(buddyValues[prop].from.y) + (buddyValues[prop].ydifference * multiplier) : parseFloat(buddyValues[prop].from.y) - (buddyValues[prop].ydifference * multiplier) || false;
          buddyValues[prop].multiplier = multiplier;
          transforms.push(prop + '(' + x + buddyValues[prop].unit + (y ? ',' + y + buddyValues[prop].unit + ')' : ')'));
          if (element === target && prop === settings.calculator) {
            targetValues.finalMove = {"x": x, "y": y};
          }
        }
      }
    });
    transforms = transforms.join(' ');
    element.style.transform = transforms;
    settings.cssValues.forEach(function(prop) {
      if (prop !== undefined) {
        let buddyValue = buddyValues[prop];
        if (buddyValue !== undefined) {
          let multiplier = calculateMultiplier(buddyValue);
          buddyValue.multiplier = multiplier;
          if (buddyValue.from < buddyValue.to) {
            element.style[prop] = buddyValue.from + buddyValue.difference * multiplier + buddyValue.unit;
          } else {
            element.style[prop] = buddyValue.from - buddyValue.difference * multiplier + buddyValue.unit;
          }
        }
      }
    });
  }


  // Transitions following the touch
  // ===============================

  function transitionWithGesture(element, translatedX, translatedY, touchmoveX, touchmoveY, isBetween, settings) {
    let movedX = Math.abs(touchmoveX - touchstartX);
    let movedY = Math.abs(touchmoveY - touchstartY);

    // Add movedX and movedY to targetValues
    targetValues.movedX = movedX;
    targetValues.movedY = movedY;

    // Only style if we're inbetween
    if (isBetween && buddies) {
      buddies.forEach(function (buddy, i) {
        let count = (buddy.className.match(/openedby:/g) || []).length;
        if (count === 0 || (count === 1 && buddy.classList.contains('openedby:' + element.getAttribute('data-touch-id')))) {
          setStyling(buddy, buddiesValues[i], settings);
        }
      });
    }
  }


  // Reset values
  // ============
  // @TODO: work with global variables?

  function resetValues() {
    touchstart = false;
    lastDifference = false;
    moveDirection = 'forward';
    target = false;
    programmaticallyClosed = false;
    targetValues = [];
    buddies = [];
    buddiesValues = [];
  }


  // Toggle
  // ======
  // @TODO: Add remaining duration here

  function toggle(target, settings) {

    // Get buddies if non are defined
    if (buddies.length === 0) {
      buddies = getBuddies(target, target);
    }

    // @TODO: rebuild now our target is also a buddy?

    // Reset target (and buddies)
    resetStyle(target);
    target.classList.toggle(settings.openClass);

    // Handle buddies
    if (buddies.length > 0) {
      buddies.forEach(function (buddy) {
        if (target.classList.contains(settings.openClass)) {
          buddy.classList.add(settings.openClass, 'openedby:' + target.getAttribute('data-touch-id'));
        } else {
          buddy.classList.remove('openedby:' + target.getAttribute('data-touch-id'));
          let count = (buddy.className.match(/openedby:/g) || []).length;
          if (count === 0) {
            buddy.classList.remove(settings.openClass);
          }
        }
      });
    }

    // Get controller
    const controller = document.querySelector('[data-touch-controls="' + target.getAttribute('data-touch-id') + '"]');
    if (controller) {
      setAria(controller, settings);
    }

    // Emit toggle event
    emitEvent('bipToggle', settings);
  }


  // Reset styling
  // =============

  function resetStyle(target) {
    target.removeAttribute('style');
    if (buddies) {
      buddies.forEach(function (buddy) {
        buddy.removeAttribute('style');
      });
    }
  }


  // Handle finished gesture
  // =======================

  function handleGesture(event, target, moveDirection, settings) {
    const diff = (targetValues.axis === 'x') ? getDifference(touchendX, touchstartX) : getDifference(touchendY, touchstartY);
    const threshold = targetValues.difference * settings.threshold;

    // Add the transitioning class
    target.classList.add(settings.transitioningClass);

    // @TODO: add remaining duration time per prop (see multiplier value in buddiesValues)
    if (diff > threshold && moveDirection === 'forward') {
      toggle(target, settings);
    } else {
      resetStyle(target);
    }

    // Reset body styling
    document.body.removeAttribute('style');

    // Remove the transitioning class
    target.ontransitionend = function() {
      target.classList.remove(settings.transitioningClass);
      target.removeAttribute('style');
      target.classList.remove(settings.touchmoveClass);
      touchstart = false;
    }

    // Remove classes when target final duration is done
    // @TODO: merge above and below and take into consideration the remaining duration of longest element
    setTimeout(function() {
      target.classList.remove(settings.transitioningClass);
      target.removeAttribute('style');
      target.classList.remove(settings.touchmoveClass);
      touchstart = false;
    }, targetValues.duration)

    // Emit dragged event
    emitEvent('bipDragged', settings);
  }


  // Set aria attributes to the button
  // =================================

  function setAria(button, settings) {
    if (button.classList.contains(settings.openClass)) {
      button.setAttribute('aria-expanded', 'true');
    } else {
      button.setAttribute('aria-expanded', 'false');
    }
  }


  /**
   * Constructor
   */

  return function (selector, options) {

    // Unique Variables
    const publicAPIs = {};
    let settings;


    // Touch start
    // ===========

    function touchstartHandler(event) {

      // Return false if target is not a gesture zone
      if (!event.target.closest(gestureZones)) return false;

      // Return false if target or closest is an ignore target
      ignore = !!event.target.closest('[data-touch-ignore]');
      if (ignore) return false;

      // Reset values for new touchstart event
      resetValues();

      // Movement variables
      touchstartX = event.changedTouches[0].screenX;
      touchstartY = event.changedTouches[0].screenY;

      // Event target
      const eventTarget = event.target.closest(gestureZones);

      // Set target
      // ==========
      target = getTarget(eventTarget, settings);
      if (!target) return false;

      // Return false if target is already transitioning
      if (target.classList.contains(settings.transitioningClass)) return false;

      // Get target values
      targetValues = getValues(target, settings);

      // Get buddies (and values)
      buddies.forEach(function (buddy) {
        buddiesValues.push(getTransitionValues(buddy, target, settings));
      });

      // Disable styling
      document.body.style.overflow = 'hidden';
      target.classList.add(settings.touchmoveClass);

      // Set touchstart to true
      touchstart = true;

      // Emit event
      emitEvent('bipDrag', settings);

    }


    // Touch move
    // ==========

    function touchmoveHandler(event) {

      // Return false for wrong elements
      if (!event.target.closest(gestureZones)) return false;
      if (!touchstart) return false;
      if (!target) return false;
      if (ignore) return false;

      // Return false if target is already transitioning
      if (target.classList.contains(settings.transitioningClass)) return false;

      // Variables
      let touchmoveX = event.changedTouches[0].screenX;
      let touchmoveY = event.changedTouches[0].screenY;
      let translatedX = (targetValues.axis === 'x') ? touchmoveX - (touchstartX - targetValues.from) : false;
      let translatedY = (targetValues.axis === 'y') ? touchmoveY - (touchstartY - targetValues.from) : false;
      let difference = (targetValues.axis === 'x') ? getDifference(touchstartX, touchmoveX) : getDifference(touchstartY, touchmoveY);
      const isBetween = (targetValues.axis === 'x') ? translatedX.between(targetValues.from, targetValues.to, true) : translatedY.between(targetValues.from, targetValues.to, true);

      // Set last difference
      if ((getDifference(difference, lastDifference) > 10) || lastDifference === false) {
        lastDifference = difference
      }

      // Set move direction
      if (isBetween && difference > lastDifference) {
        moveDirection = 'forward';
      } else if (isBetween && difference < lastDifference) {
        moveDirection = 'backward';
      }

      // Transition
      transitionWithGesture(target, translatedX, translatedY, touchmoveX, touchmoveY, isBetween, settings);
    }


    // Touch end
    // =========

    function touchendHandler(event) {

      // Return false for wrong elements
      if (!event.target.closest(gestureZones)) return false;
      if (!touchstart) return false;
      if (!target) return false;
      if (ignore) return false;

      // Return false if target is already transitioning
      if (target.classList.contains(settings.transitioningClass)) return false;

      // Variables
      touchendX = event.changedTouches[0].screenX;
      touchendY = event.changedTouches[0].screenY;

      // Handle the gesture
      if (touchstartX === touchendX && touchstartY === touchendY) {
        touchstart = false;
        clickHandler(event);
      } else {
        handleGesture(event, target, moveDirection, settings);
      }
    }


    // Click listener
    // ==============

    function clickHandler(event) {

      // Return false
      if (touchstart) return false;

      // Prevent default when element is programmatically closed
      if (programmaticallyClosed) {
        event.preventDefault();

        // Re-set programmatically closed for next event
        programmaticallyClosed = false;
      }

      // Return for wrong elements
      if (!event.target.closest(settings.controls) && !event.target.closest(settings.closes)) return false;

      // Reset for new click event
      resetValues();

      // Prevent default
      event.preventDefault();

      // Variables
      const controlTarget = event.target.closest(settings.controls);
      const closeTarget = event.target.closest(settings.closes);
      let targets = [];

      // When event target is a "close button"
      if (closeTarget) {
        let toClose = closeTarget.getAttribute(['data-touch-closes']);
        toClose = toClose.split(',');

        // Close each target
        toClose.forEach(function (el) {
          el = document.querySelector('[data-touch-id="' + el + '"]');
          if (el.classList.contains(settings.openClass)) {
            targets.push(getTarget(el, settings));
          }
        });
      }
      // When target is a "control"
      else {
        targets.push(getTarget(controlTarget, settings));
      }

      // Handle targets
      targets.forEach(function (target) {
        target.classList.add(settings.transitioningClass);
        toggle(target, settings);
        target.ontransitionend = function() {
          target.classList.remove(settings.transitioningClass);
          target.classList.remove(settings.touchmoveClass);
        }
      });

      // Remove overflow hidden from body
      document.body.removeAttribute('style');
    }


    /**
     * Toggle
     */

    publicAPIs.toggle = function (target) {
      toggle(target, settings);
    };


    /**
     * Init
     */

    publicAPIs.init = function (options) {

      // feature test
      if (!supports) return;

      // Merge options into defaults
      settings = extend(defaults, options || {});

      // Set gesture zones
      gestureZones = settings.selector + ',' + settings.controls + ',' + settings.closes;

      // Set aria
      document.querySelectorAll(settings.controls).forEach(function(control) {
        setAria(control, settings);
      });

      // Event listeners
      window.addEventListener('click', clickHandler, true);
      window.addEventListener('touchstart', touchstartHandler, true);
      window.addEventListener('touchmove', touchmoveHandler, true);
      window.addEventListener('touchend', touchendHandler, true);

    };

    // Initialize the plugin
    publicAPIs.init(options);

    // Return the public APIs
    return publicAPIs;

  };

});
