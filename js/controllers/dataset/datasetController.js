var app = angular.module('odin.datasetControllers', ['hm.readmore', '720kb.socialshare', 'leaflet-directive'])

.controller('DatasetController', DatasetController);

app.factory('model', function($resource) {
    return $resource();
});

function DatasetController($scope, $location, rest, $rootScope, $sce, $routeParams, LocationSearchService, $httpParamSerializer, $filter, leafletData, configs, $anchorScroll, usSpinnerService) {
    PDFJS.workerSrc = $rootScope.baseHtml5 + 'plugins/pdf/pdf.worker.js';
    usSpinnerService.spin('spinner');
    sessionStorage.removeItem('query');
    LocationSearchService.init();
    $rootScope.isDatasetView = true;
    $rootScope.isHome = false;
    $scope.activeCategories = [];
    $scope.url_api = $rootScope.url;

    $scope.type = "datasets";
    $scope.params = {
        slug: $routeParams.id,
        include: 'tags,categories',//,subcategories'
        fields: ['description', 'id', 'name', 'optionals', 'publishedAt', 'slug'].join()
    };

    $scope.activeCategory =   localStorage.getItem('currentCategory');

    $scope.currentColor = sessionStorage.getItem('currentColor') || '';

    L.Icon.Default.imagePath = '/images/leaflet/';



    rest().get({
        type: $scope.type,
        params: $httpParamSerializer($scope.params)
    }, function(result) {
        result.data.forEach(function(element) {
            //Because default server search is "contains"
            //In consequence, one slug could be cointaned by another when looking up
            if (element.slug == $routeParams.id) {
                $scope.info = element;
            }
        });
        $scope.info.categories.forEach(function(category) {
            $scope.activeCategories.push(category.name);
        });
        $rootScope.header = $scope.info.name;

        var tags = [];

        for (var i = 0; i < $scope.info.tags.length; i++) {
            tags.push({
                name: $scope.info.tags[i].name,
                url: $scope.info.tags[i].id,
                selected: false
            })
        }

        $scope.tags = tags;
        $scope.fileTypes = {};

        $scope.loadResults();
    });

    centerJSON = function(geo) {
        leafletData.getMap('map.id').then(function (map) {
            var latlngs = [];
            for (var i in geo.data.features) {
                var coord = geo.data.features[i].geometry.coordinates;
                var typeGeometry = geo.data.features[i].geometry.type;
                for (var j in coord) {
                    if(typeGeometry == 'Point') {
                        latlngs.push(L.GeoJSON.coordsToLatLng(coord));
                    } else if(typeGeometry == 'LineString' || typeGeometry == 'Polygon') {
                        for (var k in j) {
                            if(typeGeometry == 'LineString') {
                                latlngs.push(L.GeoJSON.coordsToLatLng(coord[j]));
                            } else if(typeGeometry == 'Polygon') {
                                for (var h in coord[j][k]) {
                                    latlngs.push(L.GeoJSON.coordsToLatLng(coord[j][k]));
                                }
                            }
                        }
                    }
                }

            }
            if (latlngs.length > 0)
                map.fitBounds(latlngs);
        });
    };

    $rootScope.$on('leafletDirectiveMap.map.id.load', function(event){
        centerJSON(event.targetScope.geojson);
    });

    $scope.loadResults = function(limit) {
        usSpinnerService.spin('spinner');
        $rootScope.countQuery ++;
        $anchorScroll('pagingDatasetResult');
        $scope.showLoading = true;
        $scope.params = $.extend({
            dataset: $scope.info.id,
            //include: 'tags',
            orderBy: 'name',
            sort: 'ASC',
            limit: 8,
            skip: 0,
            limitTable: 15,
            fields: ['description', 'fileName', 'id', 'layout', 'optionals', 'organization.name', 'name', 'publishedAt', 'type', 'updatedAt', 'url', 'gatheringDate'].join()
        }, LocationSearchService.searchParams());

        if (limit) {
            $scope.params.skip += limit;
        } else {
            $scope.params.skip = 0;
        }

        $scope.filesResults = rest()[
            $scope.params.query ? 'search' : 'get'
        ]({
            type: 'files',
            params: $httpParamSerializer($scope.params)
        }, function(result) {
            $scope.countResources = result.meta.count;
            $scope.files = $scope.filesResults.data;
            $scope.files.forEach(function(element) {

                element.additional_info = []

                angular.forEach(element.optionals, function(val, key) {
                    element.additional_info.push({
                        clave: key,
                        valor: val
                    });
                });

                element.resources = rest().resources({
                    id: element.id,
                    type: 'files'
                }, function() {
                    if (!!element.resources.data) {
                        angular.forEach(element.resources.data.maps, function(maps) {
                            if (!!maps.basemap) {
                                $rootScope.countQuery ++;
                                maps.base = rest().findOne({
                                    type: 'basemaps',
                                    id: maps.basemap.id
                                }, function() {
                                    maps.geoData = {
                                        data: maps.geojson,
                                        onEachFeature: function(feature, layer) {
                                            if (feature.properties) {
                                                var html = '';
                                                angular.forEach(feature.properties, function(value, key) {
                                                    html += '<strong>' + key + '</strong>: ' + value + '<br><br>';
                                                });
                                                var custom_options = {
                                                    'maxHeight': '200'
                                                };
                                                if (html != '') {
                                                    layer.bindPopup(html, custom_options);
                                                }
                                            }
                                        }
                                    }
                                    maps.tile = {
                                        url: maps.base.url,
                                        options: {
                                            minZoom: 0,
                                            maxZoom: 18,
                                            tms: false,
                                            attribution: ''
                                        }
                                    }
                                    if(!!maps.base.minZoom) {
                                        maps.tile.options.minZoom = maps.base.minZoom;
                                    }
                                    if(!!maps.base.maxZoom) {
                                        maps.tile.options.maxZoom = maps.base.maxZoom;
                                    }
                                    if(!!maps.base.tms) {
                                        maps.tile.options.tms = maps.base.tms;
                                    }
                                    if(!!maps.base.attribution) {
                                        maps.tile.options.attribution = maps.base.attribution;
                                    }
                                    maps.events = {
                                        map: {
                                            enable: ['load'],
                                            logic: 'emit'
                                        }
                                    }

                                    $rootScope.countQuery --;
                                    if($rootScope.countQuery == 0) { usSpinnerService.stop('spinner'); }
                                }, function(error) {
                                    $rootScope.countQuery --;
                                    if($rootScope.countQuery == 0) { usSpinnerService.stop('spinner'); }
                                });
                            }
                        });

                        for (charts in element.resources.data.charts) {
                            if ((!!element.resources.data.charts[charts]) && (!!element.resources.data.charts[charts].data)) {
                                element.resources.data.charts[charts].series = [
                                    []
                                ];
                                if (!!element.resources.data.charts[charts].dataSeries) {
                                    if (element.resources.data.charts[charts].dataType == 'qualitative') {
                                        element.resources.data.charts[charts].series[0] = element.resources.data.charts[charts].dataSeries;
                                    } else {
                                        element.resources.data.charts[charts].series[0].push(element.resources.data.charts[charts].dataSeries[1]);
                                    }
                                }
                                element.resources.data.charts[charts].dataChart = {
                                    data: [element.resources.data.charts[charts].data.data]
                                }

                                var getRandomColor = function (point) {
                                    var palette = ['#e74c3c', '#3e4f5e', '#19c3e3',
                                                   '#f39c12', '#18b596', '#fdd306', '#f56292', '#3e4f5e',
                                                   '#037dbf', '#88bf48', '#9b59b6', '#fcda59', '#e74c3c',
                                                   '#ffffff', '#19c3e3', '#9b59b6'];

                                    return palette[Math.round(point % palette.length)];
                                }
                                element.resources.data.charts[charts].colors = [];
                                if (element.resources.data.charts[charts].type != 'line') {
                                    element.resources.data.charts[charts].colors[0] = {
                                        backgroundColor: []
                                    };
                                    angular.forEach(element.resources.data.charts[charts].data.data, function(val, key) {
                                        element.resources.data.charts[charts].colors[0].backgroundColor.push(getRandomColor(key));
                                    });
                                }
                            }
                        }
                    }
                });

                if (!!element.type && !!element.type.api) {
                    $rootScope.countQuery ++;
                    element.contents = rest().contents({
                        id: element.id,
                        type: 'files',
                        params: 'limit=' + $scope.params.limitTable
                    }, function(resp) {
                        $rootScope.countQuery --;
                        if($rootScope.countQuery == 0) { usSpinnerService.stop('spinner'); }
                    }, function(error) {
                        $rootScope.countQuery --;
                        if($rootScope.countQuery == 0) { usSpinnerService.stop('spinner'); }
                    });
                }

                  if (element.layout == true) {
                    $scope.layout = true;
                    $scope.layout_id = element.id;
                  }

            });

            $scope.info.additional_info = [];

            angular.forEach($scope.info.optionals, function(val, key) {
                $scope.info.additional_info.push({
                    clave: key,
                    valor: val
                });
            });

            $scope.showLoading = false;
            $rootScope.countQuery --;
            if($rootScope.countQuery == 0) { usSpinnerService.stop('spinner'); }
        }, function(error) {
            $scope.showLoading = false;
            $rootScope.countQuery --;
            if($rootScope.countQuery == 0) { usSpinnerService.stop('spinner'); }
        });
    }



    $scope.paging = function(event, page, pageSize, total, resource) {
        $scope.showLoadingResource = true;
        var skip = (page - 1) * $scope.params.limitTable;
        //$scope.q = "&skip=" + skip + "&limit=" + $scope.limit;
        resource.contents = rest().contents({
            id: resource.id,
            type: 'files',
            params: "skip=" + skip + "&limit=" + $scope.params.limitTable
        }, function(resp) {
            $scope.showLoadingResource = false;
        }, function(error) {
            $scope.showLoadingResource = false;
        });
    };

    $scope.pagingAll = function(event, page, pageSize, total) {
        usSpinnerService.spin('spinner');
        var skip = (page - 1) * $scope.params.limit;
        $scope.page = page;
        $scope.loadResults(skip);
    };

    $scope.toggleDropdown = function(event) {
        if ($(event.target).next().hasClass('dataset-additional-info-table-inactive')) {
            $(event.target).next().addClass('dataset-additional-info-table-active');
            $(event.target).next().removeClass('dataset-additional-info-table-inactive');
            $(event.target).addClass('dataset-additional-info-active');
        } else {
            $(event.target).next().addClass('dataset-additional-info-table-inactive');
            $(event.target).next().removeClass('dataset-additional-info-table-active');
            $(event.target).removeClass('dataset-additional-info-active');
        }
    };

    $scope.getHtml = function(html) {
        return $sce.trustAsHtml(html);
    };

    $scope.getUrl = function(url) {
      return $sce.trustAsResourceUrl(url)
    }

    $scope.disqusConfig = {
        disqus_shortname: 'badataodin',
        disqus_identifier: $routeParams.id,
        disqus_url: $location.absUrl()
    };

    $scope.scroll = 0;
    $scope.loading = 'Cargando..';

    $scope.getNavStyle = function(scroll) {
        if (scroll > 100)
            return 'pdf-controls fixed';
        else
            return 'pdf-controls';
    }

    $scope.onError = function(error) {
        // console.log(error);
    }

    $scope.onLoad = function() {
        $scope.loading = '';
    }

    $scope.onProgress = function(progress) {
        // console.log(progress);
    }

    $scope.filterGroups = {};
    $scope.toggleFilterGroup = function(filterGroup) {
      $scope.filterGroups[filterGroup] = !$scope.filterGroups[filterGroup];
    };
    $scope.closeFilterMenu = function() {
      $rootScope.showFilterMenu = false;
    };
}
