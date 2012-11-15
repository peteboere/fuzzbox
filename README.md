# Flexible media lightbox for jQuery


### Why?

There are a lot of jQuery lightboxes out there. A lot of them were designed before responsive design, tablets, smartphones, CSS3 and HTML5. A lot of the good ones have become payware.

Fuzzbox features:

* Responsive (max-width not width)
* Fully themeable (themeless out of the box)
* Dynamic context and event based theming via CSS class hooks
* Extendable media handlers
* Animation used sparingly
* Animation uses CSS3 transitions where available for performance and tablet/mobile friendliness
* Fully keyboard accessible


### Basic usage

```js
// As a plugin
$( 'a' ).fuzzbox();

// Manual
$.fuzzbox.open({
  html: "Bonjour tout le monde"
});

// OOP style
var box = new $.fuzzbox();
box.open({
  theme: "gallery"
  url: "images/kitteh.jpg"
});
```

See the "demo page":http://peteboere.github.com/fuzzbox/demo for more examples.
