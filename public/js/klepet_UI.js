function divElementEnostavniTekst(sporocilo) {
  var jeSmesko = sporocilo.indexOf('http://sandbox.lavbic.net/teaching/OIS/gradivo/') > -1;
  if (jeSmesko) {
    sporocilo = sporocilo.replace(/\</g, '&lt;').replace(/\>/g, '&gt;').replace('&lt;img', '<img').replace('png\' /&gt;', 'png\' />');
    return $('<div style="font-weight: bold"></div>').html(sporocilo);
  } else {
    return $('<div style="font-weight: bold;"></div>').text(sporocilo);
  }
}

function divElementHtmlTekst(sporocilo) {
  return $('<div></div>').html('<i>' + sporocilo + '</i>');
}

function procesirajVnosUporabnika(klepetApp, socket) {
  var sporocilo = $('#poslji-sporocilo').val();
  sporocilo = dodajSmeske(sporocilo);
  var sistemskoSporocilo;

  if (sporocilo.charAt(0) == '/') {
    sistemskoSporocilo = klepetApp.procesirajUkaz(sporocilo);
    if (sistemskoSporocilo) {
      $('#sporocila').append(divElementHtmlTekst(sistemskoSporocilo));
    }
  } else {
    sporocilo = filtirirajVulgarneBesede(sporocilo);
    klepetApp.posljiSporocilo(trenutniKanal, sporocilo);
    var slike = vstavSlikoCeJe(sporocilo);
    var video = vstaviYTCeJe(sporocilo);
    if (slike && video) video = '<br>' + video;
    $('#sporocila').append(divElementEnostavniTekst(sporocilo))
                   .append(slike)
                   .append(video);
    $('#sporocila').scrollTop($('#sporocila').prop('scrollHeight'));
  }

  $('#poslji-sporocilo').val('');
}

var socket = io.connect();
var trenutniVzdevek = "", trenutniKanal = "";

var vulgarneBesede = [];
$.get('/swearWords.txt', function(podatki) {
  vulgarneBesede = podatki.split('\r\n');
});

function filtirirajVulgarneBesede(vhod) {
  for (var i in vulgarneBesede) {
    vhod = vhod.replace(new RegExp('\\b' + vulgarneBesede[i] + '\\b', 'gi'), function() {
      var zamenjava = "";
      for (var j=0; j < vulgarneBesede[i].length; j++)
        zamenjava = zamenjava + "*";
      return zamenjava;
    });
  }
  return vhod;
}

function vstavSlikoCeJe(vhod) {
  var regexstr = '(https|http):\\/\\/+\\S+\\.(png|gif|jpg)';
  var matches = vhod.match(new RegExp(regexstr, 'gi'));
  var izhod = "";
  if (matches) {
    for (var i = 0; i < matches.length; i++) {
      var jeSmesko = matches[i].indexOf('http://sandbox.lavbic.net/teaching/OIS/gradivo/') > -1;
      if (jeSmesko) continue;
      if (izhod) izhod += "<br>";
      izhod += '<img src="' + matches[i] + '" style="margin-left:20px; width:200px"/>';
    }
  }
  return izhod
}

function vstaviYTCeJe(vhod) {
  var regexstr = 'https:\\/\\/www\\.youtube\\.com\\/watch\\?v=';
  var matches = vhod.match(new RegExp(regexstr + '+\\S+', 'gi'));
  var izhod = "";
  if (matches) {
    for(var i = 0; i < matches.length; i++) {
      if (izhod) izhod += '<br>';
      var id = matches[i].replace(new RegExp(regexstr, 'gi'), '');
      izhod += '<iframe src="https://www.youtube.com/embed/' + id
               + '" allowfullscreen style="height:150px; width:200px; margin-left:20px"></iframe>';
    }
  }
  return izhod;
}

$(document).ready(function() {
  var klepetApp = new Klepet(socket);

  socket.on('vzdevekSpremembaOdgovor', function(rezultat) {
    var sporocilo;
    if (rezultat.uspesno) {
      trenutniVzdevek = rezultat.vzdevek;
      $('#kanal').text(trenutniVzdevek + " @ " + trenutniKanal);
      sporocilo = 'Prijavljen si kot ' + rezultat.vzdevek + '.';
    } else {
      sporocilo = rezultat.sporocilo;
    }
    $('#sporocila').append(divElementHtmlTekst(sporocilo));
  });

  socket.on('pridruzitevOdgovor', function(rezultat) {
    trenutniKanal = rezultat.kanal;
    $('#kanal').text(trenutniVzdevek + " @ " + trenutniKanal);
    $('#sporocila').append(divElementHtmlTekst('Sprememba kanala.'));
  });

  socket.on('sporocilo', function (sporocilo) {
    var slike = vstavSlikoCeJe(sporocilo.besedilo);
    var video = vstaviYTCeJe(sporocilo.besedilo);
    if (slike && video) video = '<br>' + video; // Če je oboje prisotno, gre video v novo vrsto
    var novElement = divElementEnostavniTekst(sporocilo.besedilo);
    $('#sporocila').append(novElement)
                   .append(slike)
                   .append(video);
  });
  
  socket.on('kanali', function(kanali) {
    $('#seznam-kanalov').empty();

    for(var kanal in kanali) {
      kanal = kanal.substring(1, kanal.length);
      if (kanal != '') {
        $('#seznam-kanalov').append(divElementEnostavniTekst(kanal));
      }
    }

    $('#seznam-kanalov div').click(function() {
      klepetApp.procesirajUkaz('/pridruzitev ' + $(this).text());
      $('#poslji-sporocilo').focus();
    });
  });

  socket.on('uporabniki', function(uporabniki) {
    $('#seznam-uporabnikov').empty();
    for (var i=0; i < uporabniki.length; i++) {
      $('#seznam-uporabnikov').append(divElementEnostavniTekst(uporabniki[i]));
    }
    $('#seznam-uporabnikov div').click(function(a) {
        var $input = $('#poslji-sporocilo'); 
        $input.val('/zasebno "' + this.innerHTML + '"');
        $input.focus();
    });
  });
  
  socket.on('dregljaj', function(podatki) {
    $('#vsebina').jrumble().trigger('startRumble');
    setTimeout(function() {
      $('#vsebina').trigger('stopRumble');
    }, 1500);
  })

  setInterval(function() {
    socket.emit('kanali');
    socket.emit('uporabniki', {kanal: trenutniKanal});
  }, 1000);

  $('#poslji-sporocilo').focus();

  $('#poslji-obrazec').submit(function() {
    procesirajVnosUporabnika(klepetApp, socket);
    return false;
  });
  
  
});

function dodajSmeske(vhodnoBesedilo) {
  var preslikovalnaTabela = {
    ";)": "wink.png",
    ":)": "smiley.png",
    "(y)": "like.png",
    ":*": "kiss.png",
    ":(": "sad.png"
  }
  for (var smesko in preslikovalnaTabela) {
    vhodnoBesedilo = vhodnoBesedilo.replace(smesko,
      "<img src='http://sandbox.lavbic.net/teaching/OIS/gradivo/" +
      preslikovalnaTabela[smesko] + "' />");
  }
  return vhodnoBesedilo;
}
