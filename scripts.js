$(function () {
  var api = "getSingle",
    keyword = "",
    item = {},
    format = "image/png",
    map,
    mapLat = 21.006423,
    mapLng = 105.841394,
    mapDefaultZoom = 14,
    layer_route;
  const toastSuccess = new bootstrap.Toast(document.getElementById("success"));
  const toastError = new bootstrap.Toast(document.getElementById("error"));
  const dropdown = new bootstrap.Dropdown(document.getElementById("dropdown"));
  toggleReadonly(true);
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      mapLat = pos.coords.latitude;
      mapLng = pos.coords.longitude;
      initialize_map(true);
    },
    () => {
      initialize_map(false);
    }
  );

  function initialize_map(isPos) {
    layerBG = new ol.layer.Tile({
      className: "osm-layer",
      source: new ol.source.OSM({}),
    });
    var layer_bg = new ol.layer.Image({
      className: "bg-layer",
      source: new ol.source.ImageWMS({
        ratio: 1,
        url: "http://localhost:8080/geoserver/internetcafe/wms",
        params: {
          FORMAT: format,
          VERSION: "1.1.1",
          STYLES: "",
          LAYERS: "internetcafe:bg",
        },
      }),
    });
    var layer_ic = new ol.layer.Image({
      className: "point-layer",
      source: new ol.source.ImageWMS({
        ratio: 1,
        url: "http://localhost:8080/geoserver/internetcafe/wms",
        params: {
          FORMAT: format,
          VERSION: "1.1.1",
          STYLES: "",
          LAYERS: "internetcafe:loc",
        },
      }),
    });
    var viewMap = new ol.View({
      center: ol.proj.fromLonLat([mapLng, mapLat]),
      zoom: mapDefaultZoom,
    });
    map = new ol.Map({
      target: "map",
      layers: [layerBG, layer_bg, layer_ic],
      view: viewMap,
    });

    if (isPos) {
      const positionFeature = new ol.Feature({
        geometry: new ol.geom.Point(
          ol.proj.transform([mapLng, mapLat], "EPSG:4326", "EPSG:3857")
        ),
      });
      positionFeature.setStyle(
        new ol.style.Style({
          image: new ol.style.Circle({
            radius: 6,
            fill: new ol.style.Fill({
              color: "#3399CC",
            }),
            stroke: new ol.style.Stroke({
              color: "#fff",
              width: 2,
            }),
          }),
        })
      );

      new ol.layer.Vector({
        map: map,
        source: new ol.source.Vector({
          features: [positionFeature],
        }),
      });
    }
    map.on("click", function (evt) {
      var zoom = map.getView().getZoom();
      var coord = ol.proj.transform(evt.coordinate, "EPSG:3857", "EPSG:4326");
      var point = "POINT(" + coord[0] + " " + coord[1] + ")";
      if (api == "getSingle") {
        callAPI(api, point, "", zoom, item).then((res) => {
          if (res) {
            setItem(res);
            openAside();
          } else closeAside();
          hideRoute();
        });
      } else {
        callAPI("isInHN", point, "", zoom, item)
        .then((res) => {
          if (res) {
            return callAPI("getSingle", point, "", zoom, item);
          }
          closeAside();
          hideRoute();
        })
        .then((res) => {
          if (api == "edit" && res) {
            item = res;   
            toggleReadonly(false);
            setItem(res);
            openAside();
          } else if (api == "add" && !res) {
            item = {};
            toggleReadonly(false);
            setItem(item);
            item.geom = point;
            openAside();
          } else if (api == "delete" && res)
            callAPI(api, point, "", zoom, res).then((res) => {
              if (res) {
                toastSuccess.show();
                layer_ic.getSource().changed();
              }
              else
                toastError.show();
            });
          else closeAside();
          hideRoute();
        });
      }
      layer_ic.getSource().changed();
    });

    $("#save").click(function () {
      item = getItem();
      callAPI(api, null, "", 0, item).then((res) => {
        res ? toastSuccess.show() : toastError.show();
        layer_ic.getSource().changed();
      });
      toggleReadonly(true);
    });

    $("#cancel").click(() => {
      closeAside();
      hideRoute();
    });

    function callAPI(api, point, keyword, distance, item) {
      return new Promise((resolve, reject) => {
        $.ajax({
          type: "POST",
          url: "api.php",
          data: {
            function: api,
            point: point,
            keyword: keyword,
            distance: distance,
            item: item,
          },
          success: function (result) {
            resolve(JSON.parse(result));
          },
          error: function (req, status, error) {
            reject(req + " " + status + " " + error);
          },
        });
      });
    }

    $("#search").keyup(() => {
      search();
    });

    $("search_btn").click(() => {
      search();
    });

    function hideRoute(){
      if (layer_route) 
      map.removeLayer(layer_route);
    }

    function showRoute(x1, y1, x2, y2) {
      if (!isPos)
        return;
        hideRoute()
      layer_route = new ol.layer.Image({
        className: "route-layer",
        source: new ol.source.ImageWMS({
          ratio: 1,
          url: "http://localhost:8080/geoserver/internetcafe/wms",
          params: {
            FORMAT: format,
            VERSION: "1.1.1",
            STYLES: "",
            LAYERS: "internetcafe:route",
            viewparams:
              "x1:" + x1 + ";y1:" + y1 + ";x2:" + x2 + ";y2:" + y2 + ";",
          },
        }),
      });
      map.addLayer(layer_route);
    }

    function search() {
      keyword = $("#search").val();
      callAPI(
        "listAll",
        "POINT(" + mapLng + " " + mapLat + ")",
        keyword,
        0,
        null
      ).then((res) => {
        if (res) {
          let htmlString = "";
          res.forEach((row) => {
            htmlString +=
              `<li class="dropdown-item border-bottom">
            <div class="row align-items-center item-container" data-id="` +
              row.id +
              `">
              <div class="col-10 row">
                <p class="col-12 m-auto">` +
              row.name +
              `</p>
                <p class="col-12 m-auto">` +
              row.addr +
              `</p>
              </div>
              <span class="col-2 p-2">` +
              row.distance.slice(0, 4) +
              ` km</span>
            </div>
          </li>`;
            $("#dropdown").html(htmlString);

            $(".dropdown-item").on("click", ".item-container", function (e) {
              var id = $(this).data("id");
              $.ajax({
                type: "POST",
                url: "api.php",
                data: {
                  function: "getByID",
                  id: id,
                },
                success: function (result) {
                  item = JSON.parse(result);
                  setItem(item);
                  showRoute(
                    mapLng,
                    mapLat,
                    parseFloat(item.lng),
                    parseFloat(item.lat)
                  );
                  let zoomPoint;
                  if(isPos)
                    zoomPoint = ol.proj.transform(
                      [(mapLng+ parseFloat(item.lng))/2, (mapLat+ parseFloat(item.lat))/2],
                      "EPSG:4326",
                      "EPSG:3857"
                    )
                  else
                    zoomPoint = ol.proj.transform(
                      [parseFloat(item.lng), parseFloat(item.lat)],
                      "EPSG:4326",
                      "EPSG:3857"
                    )
                  let zoomLvl = isPos ? 14 : 17;
                  map
                    .getView()
                    .fit(
                      new ol.geom.Point(
                        zoomPoint
                      ),
                      {
                        maxZoom: zoomLvl,
                      }
                    );
                  openAside();
                  dropdown.hide();
                },
              });
            });
          });
          dropdown.show();
        }
      });
    }
    $(".fe_rt").click(function (e) {
      $(".exit-btn").hide();
      $(".aside").hide();
      $(".fe_rt").removeClass("selected");
      $(this).addClass("selected");
      $("#search").val("");
      api = $(this).data("api");
      if (api === "add" || api === "edit") {
        toggleReadonly(false);
      }
      toggleReadonly(true);
      hideRoute()
    });

    $(".exit-btn").click(function (e) {
      closeAside();
      hideRoute()
    });
  }
  
  function openAside() {
    $(".exit-btn").show();
    $(".aside").show();
  }
  function closeAside() {
    $("#deafault").click();
    $(".exit-btn").hide();
    $(".aside").hide();
    dropdown.hide();
    item = {};
    setItem(item);
    toggleReadonly(true);
  }

  function setItem(item) {
    $("#name").val(item.name);
    $("#addr").val(item.addr);
    $("#opening-hour").val(item.opening_hour);
    $("#url").val(item.url);
    $("#phone-num").val(item.phone_num);
    $("#min-price").val(item.min_price);
    $("#max-price").val(item.max_price);
    $("#device-num").val(item.device_num);
  }

  function getItem() {
    item.name = $("#name").val();
    item.addr = $("#addr").val();
    item.opening_hour = $("#opening-hour").val();
    item.url = $("#url").val();
    item.phone_num = $("#phone-num").val();
    item.min_price = $("#min-price").val();
    item.max_price = $("#max-price").val();
    item.device_num = $("#device-num").val();
    return item;
  }
  function toggleReadonly(isReadonly) {
    $("#name").prop("readonly", isReadonly);
    $("#addr").prop("readonly", isReadonly);
    $("#opening-hour").prop("readonly", isReadonly);
    $("#url").prop("readonly", isReadonly);
    $("#phone-num").prop("readonly", isReadonly);
    $("#min-price").prop("readonly", isReadonly);
    $("#max-price").prop("readonly", isReadonly);
    $("#device-num").prop("readonly", isReadonly);
    if (!isReadonly) {
      $("#save").show();
      $("#cancel").show();
    } else {
      $("#save").hide();
      $("#cancel").hide();
    }
  }
});
