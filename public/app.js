async function analyze(){


const loading=document.getElementById("loading");

const result=document.getElementById("result");

const routes=document.getElementById("routes");



loading.innerHTML=
`
🤖 Climora AI Processing...

<br>
🔎 Scanning routes...

<br>
🌫️ Checking pollution levels...

<br>
🧠 Calculating sustainable path...
`;



const payload={


routes:[


{
id:"A",
name:"Fastest Route",
duration_minutes:180,
pm25_ug_m3:80
},


{
id:"B",
name:"Cleaner Route",
duration_minutes:192,
pm25_ug_m3:50
},


{
id:"C",
name:"Long Detour",
duration_minutes:360,
pm25_ug_m3:20
}


],


max_extra_percent:15,

max_extra_minutes:25


};




try{


const res=await fetch(

"https://gbxdgy9b09.execute-api.ap-south-1.amazonaws.com/analyze-route",

{

method:"POST",

headers:{

"Content-Type":"application/json"

},


body:JSON.stringify(payload)


}

);



const data=await res.json();


const body=JSON.parse(
data.body || JSON.stringify(data)
);



let best=body.recommended_route;




result.innerHTML=

`

<h2>
🤖 AI Recommended Route
</h2>


<h1>
${best.name}
</h1>


<p>
🚗 Travel Time:
${best.duration_minutes} minutes
</p>


<p>
🌫️ PM2.5 Exposure:
${best.pm25_ug_m3}
</p>


<p>
📊 Exposure Score:
${best.exposure_index}
</p>


<p>
${body.reason}
</p>


`;






routes.innerHTML="";



body.valid_routes
.concat(body.rejected_routes)
.forEach(route=>{


routes.innerHTML+=


`

<div class="result-card">


<h2>
${route.name}
</h2>


<p>
Time:
${route.duration_minutes} minutes
</p>


<p>
PM2.5:
${route.pm25_ug_m3}
</p>


<p>
Exposure:
${route.exposure_index}
</p>


</div>


`;


});




document.getElementById("pollution")
.innerHTML="32%";



document.getElementById("carbon")
.innerHTML="18 kg";



document.getElementById("score")
.innerHTML="86";



loading.innerHTML="";


}

catch(error){


console.log(error);


loading.innerHTML=
"API Connection Error";


}


}





document
.getElementById("account")
.onclick=()=>{

alert("Login system coming next");

};