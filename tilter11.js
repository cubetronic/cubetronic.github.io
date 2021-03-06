// revision 11
// getDirections() depends on three.js r124
//   ECI<->ECEF depends on getDirections


////////////////////////////////////////////////////////////////////////////////
// tilting (rotate/transform) between icrf and body frame (eci)
/*
	// see iau report: WGCCRE2009reprint.pdf
	// for reference, this is how bodies are oriented:
	// setup (threejs creates objects y-up even if defaultUp is z)
	body[moon].mesh.rotation.set(Math.PI / 2, 0, 0);
	
	// apply dec, then ra, then W eastward
  body[moon].mesh.rotateOnWorldAxis(
  	yAxis, (Math.PI / 2) - body[moon].declination);
  body[moon].mesh.rotateOnWorldAxis(zAxis, body[moon].rightAscension);
	body[moon].mesh.rotation.y += (Math.PI / 2) + body[moon].primeMeridian;

// in three.js, tilting could be done like this:

// transform vector from icrf to tilt (z-up)
rotateOnWorldAxis(z, -ra)
rotateOnWorldAxis(y, dec - Math.PI / 2)

// transform vector from tilt to icrf (z-up)
rotateOnWorldAxis(y, Math.PI / 2 - dec)
rotateOnWorldAxis(z, ra)

*/

// to convert orbital coordinates to a local body frame,
// don't rotate to MATCH the body frame,
// but rather rotate in the equal and opposite direction

// transform vectors from icrf to local body frame (all z-up)
function icrfToEci(icrf, ra, dec) {
	let {x, y, z, vx, vy, vz} = icrf;

	// rotate on z axis, -ra
	let x2 = x * Math.cos(-ra) - y * Math.sin(-ra);
	let vx2 = vx * Math.cos(-ra) - vy * Math.sin(-ra);
	let y2 = y * Math.cos(-ra) + x * Math.sin(-ra);
	let vy2 = vy * Math.cos(-ra) + vx * Math.sin(-ra);
	
	// rotate on y axis (dec - Math.PI / 2) must swap signs
	let angle = -dec + Math.PI / 2;
	let x3 = x2 * Math.cos(angle) - z * Math.sin(angle);
	let vx3 = vx2 * Math.cos(angle) - vz * Math.sin(angle);
	let z2 = z * Math.cos(angle) + x2 * Math.sin(angle);
	let vz2 = vz * Math.cos(angle) + vx2 * Math.sin(angle);
	
	x = x3;
	vx = vx3;
	y = y2;
	vy = vy2;
	z = z2;
	vz = vz2;
	
	return {x, y, z, vx, vy, vz};
}

// transform vectors from local body frame to icrf (all z-up)
function eciToIcrf(eci, ra, dec) {
	let {x, y, z, vx, vy, vz} = eci;
	
	// rotate on y axis (Math.PI / 2 - dec) must swap signs
	let angle = -Math.PI / 2 + dec;
	let x2 = x * Math.cos(angle) - z * Math.sin(angle);
	let vx2 = vx * Math.cos(angle) - vz * Math.sin(angle);
	let z2 = z * Math.cos(angle) + x * Math.sin(angle);
	let vz2 = vz * Math.cos(angle) + vx * Math.sin(angle);
	
	// rotate on z axis, ra
	let x3 = x2 * Math.cos(ra) - y * Math.sin(ra);
	let vx3 = vx2 * Math.cos(ra) - vy * Math.sin(ra);
	let y2 = y * Math.cos(ra) + x2 * Math.sin(ra);
	let vy2 = vy * Math.cos(ra) + vx2 * Math.sin(ra);
	
	x = x3;
	vx = vx3;
	y = y2;
	vy = vy2;
	z = z2;
	vz = vz2;

	return {x, y, z, vx, vy, vz};
}


////////////////////////////////////////////////////////////////////////////////
// Convert Earth-Centered-Earth-Fixed (ECEF) to Lat, Lon, Altitude
// Input is x, y, z in meters
// Returned array contains lat and lon in radians, and altitude in meters
function ecefToGps(ecef, radiusEquator, e2) {
	let {x, y, z} = ecef;
	
	const a = radiusEquator;
	const a1 = a*e2;
	const a2 = a1*a1;
	const a3 = a1*e2/2;
	const a4 = 2.5*a2;
	const a5 = a1+a3;
	const a6 = 1-e2;
	
	let s,c,ss;
	let lat;
	
	let zp = Math.abs( z );
	let w2 = x*x + y*y;
	let w = Math.sqrt( w2 );
	let r2 = w2 + z*z;
	let r = Math.sqrt( r2 );
	const lon = Math.atan2( y, x );       //Lon (final)
	let s2 = z*z/r2;
	let c2 = w2/r2;
	let u = a2/r;
	let v = a3 - a4/r;
	if ( c2 > 0.3 ) {
	  s = ( zp/r )*( 1.0 + c2*( a1 + u + s2*v )/r );
	  lat = Math.asin( s );      //Lat
	  ss = s*s;
	  c = Math.sqrt( 1.0 - ss );
	}
	else {
	  c = ( w/r )*( 1.0 - s2*( a5 - u - c2*v )/r );
	  lat = Math.acos( c );      //Lat
	  ss = 1.0 - c*c;
	  s = Math.sqrt( ss );
	}
	let g = 1.0 - e2*ss;
	let rg = a/Math.sqrt( g );
	let rf = a6*rg;
	u = w - rg*c;
	v = zp - rf*s;
	let f = c*u + s*v;
	let m = c*v - s*u;
	let p = m/( rf/g + f );
	lat += p;      //Lat
	const alt = f + m*p/2.0;     //Altitude
	if ( z < 0.0 ) {
		lat *= -1.0;     //Lat
	}
	return {lat, lon, alt};    //Return Lat, Lon, Altitude in that order
}

//Convert Lat, Lon, Altitude to Earth-Centered-Earth-Fixed (ECEF)
//Input is lat, lon (rads) and alt (m)
//Returns x, y, z in meters
function gpsToEcef(gps, radiusEquator, e2) {
	let {lat, lon, alt} = gps;
	const a = radiusEquator;
	let n = a/Math.sqrt( 1 - e2*Math.sin( lat )*Math.sin( lat ) );
	const x = ( n + alt )*Math.cos( lat )*Math.cos( lon );
	const y = ( n + alt )*Math.cos( lat )*Math.sin( lon );
	const z = ( n*(1 - e2 ) + alt )*Math.sin( lat );
	const vx = 0;
	const vy = 0;
	const vz = 0;
	return {x, y, z, vx, vy, vz};
}




////////////////////////////////////////////////////////////////////////////////
// COMPASS
/*
  depends:
  	three.js r124 (NOT as modules)
	requires:
		position vector (icrf frame, or unspecified) of satellite
	optional:
		celestial body quaternion
	returns:
		ENU unit vectors: East, North, and Up in z-up or y-up
	
	NOTE: the "up" produced here is "away from the center of mass",
		but not necessarily perpendicular to the surface on an ellipsoid
*/
// re-use instead of recreating
const localPosition = new THREE.Vector3();
let upAxisV3 = new THREE.Vector3();
let eastAxisV3 = new THREE.Vector3();
let northAxisV3 = new THREE.Vector3();
let navAxesFailsafe = false;
// passing a quaternion argument is OPTIONAL, and changes y-up/z-up
function getDirections(x, y, z, quaternion) {
	
	// uses ICRF (non-tilted), and tilts if specified
	// use local position for nearby object, not system position
	localPosition.set(x, y, z);

	// ENU convention: East, North, Up
	// up is +z, which is different from NED orientation for spacecraft
	// not to be confused with y-up or z-up
	////////// UP: CREATE A UNIT VECTOR
	upAxisV3 = localPosition.normalize();

	// edge case safety: if the rocket has journeyed to the centre of the earth
	if (upAxisV3.x === 0 && upAxisV3.y === 0 && upAxisV3.z === 0) {
		upAxisV3.z = Number.EPSILON;
		navAxesFailsafe = true;
	}
	else {
		navAxesFailsafe = false;
	}

	////////// EAST: CREATE A UNIT VECTOR
	// z is up, but sphere textures load y-up by default
	if (quaternion !== undefined) {
		eastAxisV3.set(0, 1, 0)
			.applyQuaternion(quaternion)
			.cross(localPosition)
			.normalize();
	}
	else {
		// without quaternion. USE Z-UP FOR PURE SPACE DIRECTIONS!!!
		eastAxisV3.set(0, 0, 1)
			.cross(localPosition)
			.normalize();
	}

	// edge case safety: if exactly above the north or south pole.
	if (eastAxisV3.x === 0 && eastAxisV3.y === 0 && eastAxisV3.z === 0) {
		eastAxisV3.x = Number.EPSILON;
		navAxesFailsafe = true;
	}
	else {
		navAxesFailsafe = false;
	}

	////////// NORTH: CREATE A UNIT VECTOR
	northAxisV3 = upAxisV3.clone().cross(eastAxisV3);
	
	return {eastAxisV3, northAxisV3, upAxisV3};
}

////////////////////////////////////////////////////////////////////////////////
// Earth-Centered-Inertial and Earth-Centered-Earth-Fixed

// depends on gps and getDirections()
// ECI/Orbit (body frame) to ECEF/Surface (body frame) (all z-up)
function eciToEcef(eci, angle, angularVelocity, radiusEquator, e2) {
	let {x, y, z, vx, vy, vz} = eci;
	// rotate on z axis
	let x2 = x * Math.cos(-angle) - y * Math.sin(-angle);
	let vx2 = vx * Math.cos(-angle) - vy * Math.sin(-angle);
	let y2 = y * Math.cos(-angle) + x * Math.sin(-angle);
	let vy2 = vy * Math.cos(-angle) + vx * Math.sin(-angle);
	x = x2;
	vx = vx2;
	y = y2;
	vy = vy2;
	
	// to modify speed according to planet rotation, first find
	// the surface below the spacecraft
	let gpsNow = ecefToGps({x, y, z}, radiusEquator, e2);
	gpsNow.alt = 0;
	let centerToSurface = gpsToEcef(gpsNow, radiusEquator, e2);
	
	// surface speed is xy (not xyz) distance from origin to surface
	let distance = Math.sqrt(centerToSurface.x**2 + centerToSurface.y**2);
	let tangentVelocity = angularVelocity * distance;
	
	// get eastAxisV3 (don't use quaternion!)
	const enu = getDirections(x, y, z);
	
	// negate planetary spin velocity
	vx -= tangentVelocity * enu.eastAxisV3.x;
	vy -= tangentVelocity * enu.eastAxisV3.y;
	
	// z and vz pass through unchanged
	return {x, y, z, vx, vy, vz};
}



// depends on gps and getDirections()
// ECEF/Surface (body frame) to ECI (all z-up)
function ecefToEci(ecef, angle, angularVelocity, radiusEquator, e2) {
	let {x, y, z, vx, vy, vz} = ecef;
	// rotate on z axis
	let x2 = x * Math.cos(angle) - y * Math.sin(angle);
	let vx2 = vx * Math.cos(angle) - vy * Math.sin(angle);
	let y2 = y * Math.cos(angle) + x * Math.sin(angle);
	let vy2 = vy * Math.cos(angle) + vx * Math.sin(angle);
	x = x2;
	vx = vx2;
	y = y2;
	vy = vy2;
	
	// to modify speed according to planet rotation, first find
	// the surface below the spacecraft
	let gpsNow = ecefToGps({x, y, z}, radiusEquator, e2);
	gpsNow.alt = 0;
	let centerToSurface = gpsToEcef(gpsNow, radiusEquator, e2);
	
	// surface speed is xy (not xyz) distance from origin to surface
	let distance = Math.sqrt(centerToSurface.x**2 + centerToSurface.y**2);
	let tangentVelocity = angularVelocity * distance;
	
	// get eastAxisV3 (don't use a quaternion!)
	const enu = getDirections(x, y, z);
	
	// add planetary spin velocity
	vx += tangentVelocity * enu.eastAxisV3.x;
	vy += tangentVelocity * enu.eastAxisV3.y;
	
	// z and vz pass through unchanged
	return {x, y, z, vx, vy, vz};
}




/*
use radiusEquator & flattening to get e2 and radiusPole
not radiusEquator & radiusPole to get flattening and e2

reason:

NASA HORIZONS earth data:
a = 6378.137 km
b = 6356.752 km
f = 1/298.257223563
f = 0.0033528106647

// extremely precise
pole radius from eq radius & flattening
diff = a * f = 21.3846857545176639
b = a - diff = 6356.7523142454823361

// inaccurate
flattening from radii
f = (a - b) / a
f = 21.385 / a
f = 0.0033528599338
1 / f = 298.25284078200

*/



/*
use sidereal to get angular velocity (rot. rate rad/s)
not the other way around

reason:

NASA HORIZONS earth data:
Mean sidereal day, hr    = 23.9344695944
Rot. Rate (rad/s)        = 0.00007292115

// accurate
rotRate from siderealHr:
23.9344695944 * 60 * 60 = 86,164.09053984 = x
1/x * 2?? = 0.0000729211585454

// inaccurate
siderealHr from rotRate:
0.00007292115 / (2??) = 0.0000116057614784
x = 86164.100637527 / 60 / 60 = 23.934472399313

*/
