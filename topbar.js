// Announcement bar at the very top: rotates through a few short messages.
(function () {
  var bar = document.getElementById('topbar');
  if (!bar) return;
  var items = [].slice.call(bar.querySelectorAll('.tb-item'));
  if (!items.length) return;
  var i = 0;
  items[0].classList.add('on');
  if (items.length < 2) return;
  setInterval(function () {
    var a = items[i];
    i = (i + 1) % items.length;
    var b = items[i];
    a.classList.remove('on');
    a.classList.add('out');
    setTimeout(function () { a.classList.remove('out'); }, 700);
    b.classList.add('on');
  }, 4800);
})();
