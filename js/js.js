const apiUrl = "http://localhost:8081";
const institutionID = "evaschulze";
const configType = new URLSearchParams(window.location.search).get('userType') || 'isStudent';

let classes = [];
let userConfig;

(async () => {
    var defaultConfig = await (await fetch(apiUrl + '/vp-institution/' + institutionID + '/config/default')).json();
    var userConfigBucker = defaultConfig.config.find(c => c.type == "otherConfigBucket" && c.visibilityConditionId == configType).value;
    userConfig = await (await fetch(apiUrl + '/vp-institution/' + institutionID + '/config/' + userConfigBucker)).json();

    classes = getClasses(userConfig);
    displayClasses();

    document.querySelectorAll('.class-option').forEach((element, index) => {
        element.addEventListener('click', async () => {
            var planData = await getPlanforClass(classes[index].class);

            document.querySelector("#class-name").innerHTML = "Klasse " + classes[index].class;

            displayPlan(splitPlanData(planData));
        });
    });
})();

function getClasses(userConfig) {
    userConfig.config.forEach(element => {
        if (element.param == "student-class") {
            classes.push({class: element.value, planBucketID: undefined});
        }
    });
    classes.forEach((classObj, index) => {
        var conditionSet = [];
        var selectedClassCondition = userConfig.conditionSets.find(cond => (cond.type == "paramIs" && cond.left == "student-class" && cond.right == classObj.class)).id;
        conditionSet.push(selectedClassCondition);
        var enabledCourseSelectionCondition = userConfig.conditionSets.find(cond => (cond.type == "paramIs" && cond.left == "student-enable-course-selection-" + classObj.class && cond.right == "full")).id;
        var joinedCondition = userConfig.conditionSets.find(cond => (cond.type == "and" && cond.left == enabledCourseSelectionCondition && cond.right == selectedClassCondition)).id;
        conditionSet.push(joinedCondition);

        var contentBuckets = userConfig.contentBucketSets.filter(sets => conditionSet.includes(sets.usageConditionId));  
        var fullPlanBucket = contentBuckets.find(bucket => bucket.type == "plan");
        classes[index].planBucketID = fullPlanBucket.id;
    })
    
    classes.sort((a, b) => sortClassNames(a.class, b.class));
    return classes;
}

async function getPlanforClass(className) {
    var buckerID = classes.find(c => c.class == className).planBucketID;
    var planData = await (await fetch(apiUrl + '/vp-institution/' + institutionID + '/plan/' + buckerID)).json();
    return planData;
}

function splitPlanData(planData) {
    var byDay = splitPlanDataByDay(planData);
    for (let day in byDay) {
        byDay[day] = splitDayPlanByPeriods(byDay[day]);
    }
    return byDay;   
}

function splitPlanDataByDay(planData) {
    let days = {};
    for (let entry of planData.items) {
        if (!days[entry.date]) {
            days[entry.date] = [];
        }
        days[entry.date].push(entry);
    }
    return days;   
}

function splitDayPlanByPeriods(dayPlan) {
    let periods = [];
    for (let entry of dayPlan) {
        if (!periods[entry.lesson -1]) {
            periods[entry.lesson -1] = [];
        }
        periods[entry.lesson -1].push(entry);
    }
    return periods;   
}

function displayClasses() {
    const classContainer = document.querySelector('#class-selection');
    classContainer.innerHTML = '';
    classes.forEach(classObj => {
        classContainer.innerHTML += '<div class="class-option" style="grid-column:' + (/[^0-9]/.test(classObj.class) ? "" : "1 / -1") +  ';">Klasse ' + classObj.class + '</div>';
    });
}

/**
 * @typedef {Object} LessonEntry
 * @property {number} lesson - The lesson/period number.
 * @property {string|null} subject - The lesson subject/name.
 * @property {boolean} subjectChanged - Indicates if the subject has changed from base timetable.
 * @property {string|null} teacher - The teacher's name.
 * @property {boolean} teacherChanged - Indicates if the teacher has changed from base timetable.
 * @property {string|null} room - The room identifier.
 * @property {boolean} roomChanged - Indicates if the room has changed from base timetable.
 * @property {string|null} info - Additional information about the lesson/change.
 * @property {string} class - Class name/identifier.
 * @property {string} date - ISO date string ("YYYY-MM-DD").
 * @property {string|null} startTime - ISO time string ("HH:MM").
 * @property {string|null} endTime - ISO time string ("HH:MM").
 /

/**
 * @param {Object<string, LessonEntry[][]>} planData An object mapping ISO date strings ("YYYY-MM-DD") to arrays of periods. Each period is an array of LessonEntry objects.
 */
function displayPlan(planData) {
    var today = "2025-12-01";

    var planToday = planData[today];
    var date = new Date(today);
    const planContainer = document.querySelector('#plan_today');
    planContainer.querySelector('.plan-header-date').innerHTML = date.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' });
    var lessonCon = planContainer.querySelector('.period-container');
    lessonCon.innerHTML = '';
    for (let period = 0; period < planToday.length; period++) {
        const periodEntries = planToday[period] || [];
        var periodHtml = '<div class="period-entry">';
        periodHtml += '<div class="period-number">Stunde ' + (period + 1) + '</div>';
        periodHtml += '<div class="lesson-container">';
        periodEntries.forEach(entry => {
            periodHtml += '<div class="lesson-details">';
                periodHtml += '<div class="subject' + (entry.subjectChanged ? ' changed' : '') + '">' + (entry.subject || '---') + '</div>';
                periodHtml += '<div class="teacher' + (entry.teacherChanged ? ' changed' : '') + '">' + (entry.teacher || '---') + '</div>';
                periodHtml += '<div class="room' + (entry.roomChanged ? ' changed' : '') + '">' + (entry.room || '---') + '</div>';
                if (entry.info) {
                    periodHtml += '<div class="info">Info: ' + entry.info + '</div>';
                }
            periodHtml += '</div>';
        });
        periodHtml += '</div>';
        periodHtml += '</div>';
        lessonCon.innerHTML += periodHtml;        
    }
}

function sortClassNames(a, b) {
    const numA = parseInt(a.replace(/\D/g, ''));
    const numB = parseInt(b.replace(/\D/g, ''));
    if (numA === numB) {
        return a.localeCompare(b);
    }
    return numA - numB;
}