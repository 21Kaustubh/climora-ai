let selectedRoute = "cleaner";


function createMap(){


const map=document.getElementById("routeMap");


map.innerHTML=`

<div class="map-label">
CLIMORA AI ROUTE ENGINE
</div>


<div class="map-start">
A
</div>


<div class="map-end">
B
</div>



<div 
class="route-line fastest"
onclick="selectRoute('fastest')">
</div>


<div 
class="route-line cleaner"
onclick="selectRoute('cleaner')">
</div>



<div 
class="route-line detour"
onclick="selectRoute('detour')">
</div>



<div class="vehicle">
🚗
</div>


<div class="pollution-zone zone1"></div>

<div class="pollution-zone zone2"></div>


`;


}




function selectRoute(route){


selectedRoute=route;


document
.querySelectorAll(".route-line")
.forEach(r=>{

r.style.opacity="0.25";

});



document
.querySelector("." + route)
.style.opacity="1";



document
.querySelector("." + route)
.style.height="18px";


}



document.addEventListener(
"DOMContentLoaded",
()=>{

createMap();

selectRoute("cleaner");

});