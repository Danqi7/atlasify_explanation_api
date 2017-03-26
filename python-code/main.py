from commands import getstatusoutput
from multiprocessing import  Queue
from threading import Thread
from pymongo import MongoClient
from bisect import bisect_left
import Levenshtein
import re
from nltk import ngrams, sent_tokenize 
import sys
import heapq
from numpy import linalg
from json import dumps
from itertools import chain

def binary_search(a, x, lo=0, hi=None):   # can't use a to specify default for hi
	hi = hi if hi is not None else len(a) # hi defaults to len(a)
	pos = bisect_left(a,x,lo,hi)          # find insertion position
	return (pos if pos != hi and a[pos] == x else -1) # don't walk off the end

def conceptKey(concept):
	pattern = re.compile('[\W_]+')
	return re.sub('\s+', ' ', pattern.sub(" ",re.sub(r'(_|(\([^\)]+\)))', ' ', concept.lower()))).strip()

def curatedSentence(para, concept1indices, concept2indices = [], joinBy=" "):
	sentences = sent_tokenize(para)
	wordIndices = []
	resultSentenceIndices = []
	count = 0
	for i in sentences:
		count+=len(i.split(' '));
		wordIndices.append(count);
	resultSentenceIndices = set([bisect_left(wordIndices,i) for i in concept1indices + concept2indices])
	return joinBy.join([sentences[i] for i in resultSentenceIndices])

def getIndexes(tempPara, concept):
	conceptA = conceptKey(concept)
	tempPara = tempPara.lower()
	comparisonRatio = 0.8
	conceptIndexes = []
	try:
		if conceptA.count(' ') > 0:
			ngramIterator = ngrams( filter(None, tempPara.split(' ')), conceptA.count(' ')+1 )
			conceptIndexes = filter(lambda (key, item) : " ".join(item).find(unicode(conceptA))>=0, enumerate(ngramIterator)) or filter(lambda (key, item) : Levenshtein.ratio(" ".join(item), unicode(conceptA)) > comparisonRatio,enumerate(ngramIterator))
		else:
			conceptIndexes = filter(lambda (key, item) : item.find(unicode(conceptA))>=0,enumerate(tempPara.split(' ')))
			if not(conceptIndexes) and len(conceptA)>5:
				conceptIndexes = filter(lambda (key, item) : Levenshtein.ratio(item, unicode(conceptA) ) > comparisonRatio,enumerate(tempPara.split(' ')))
		return [i[0] for i in conceptIndexes]
	except:
		return []

def getOneSentenceEach(completeText, concept1, concept2):
	indexConcept1 = getIndexes(completeText, concept1)
	indexConcept2 = getIndexes(completeText, concept2)
	if indexConcept1 and indexConcept2:
		return [ {"header": "", "curated" : curatedSentence(completeText, indexConcept1[:1], indexConcept2[:1], ".. "), "complete" : ""} ]
	else:
		return []

def findSentences(score, para, header, concept1, concept2, flag=0):
	if flag==0:
		concept1indices = []
		concept2indices = getIndexes(para, concept2)
	elif flag==1:
		concept1indices = getIndexes(para, concept1)
		concept2indices = []
	else:
		concept1indices, concept2indices = map(lambda x: getIndexes(para, x), [concept1, concept2])
	
	if (flag==2 and concept1indices and concept2indices) or ((flag in [0,1]) and (concept1indices or concept2indices)):
		return {"header": header, "curated" : curatedSentence(para, concept1indices, concept2indices), "complete" : "", concept1: concept1indices, concept2: concept2indices }
	else:
		return None

def end_of_loop():
	raise StopIteration

def getParagraps(response):
	result = list(re.sub("\s+|\n", " ", response['plainText'][x['offset']:x['endOffset']]) if x["locType"]=="OVERVIEW" else end_of_loop() for x in response['paragraphs'])
	header = ["Abstract"]*len(result)
	paraOffsets = map(lambda x : x['endOffset'], response['paragraphs'])
	for section in response['sections']:
		if section['sectionTitle'] != "References":
			hooks = filter(lambda y : bisect_left([section['endHeadingOffset'], section['endOffset']], y)==1, paraOffsets)
			hooks = [section['endHeadingOffset']] + hooks
			header.extend([section['sectionTitle']]*(len(hooks)-1))
			result.extend(map(lambda (a,b): re.sub("\s+|\n", " ", response['plainText'][a:b]), zip(hooks[:-1],hooks[1:])))
		else:
			break
	return result, header

def filterText(id, score, enwiki, concept1, concept2, queue=None):
	response = enwiki['page'].find_one({'title.id':int(id), 'title.namesapce':0}, {'title': True, 'plainText': True, 'paragraphs': True, 'sections': True})
	try:
		title = response['title']['title']
		paragraphs, header = getParagraps(response)
		solutions = filter(None, map(lambda k : findSentences(score, paragraphs[k], header[k], concept1, concept2, [concept1, concept2, title].index(title)), xrange(len(paragraphs))))
		if solutions:
			queue.put( [score, { "title" : title, 'c-score': score, "paragraphs" : solutions, "type": 1 }] )
		else:
			queue.put( [score, { "title" : title, 'c-score': score, "paragraphs" : getOneSentenceEach("\n".join(paragraphs), concept1, concept2), "type": 2 }])
	except:
		print "Unexpected error:", sys.exc_info()
		return queue.put( [score, { "title" : title, 'c-score': score, 'paragraphs': [], "type": 3 }] )

def getTopRelatedTopics(searchID1, searchID2, N):
	result=getstatusoutput("/usr/lib/jvm/java-1.7.0/bin/java -jar /home/geoadmin/atlasify-be/python-code/SrApi.jar /disk2/v1/ /disk2/v1/raf "+searchID1+" "+searchID2 + " " + str(N))[1].split(';')[:-1]
	return map(lambda x: (x.split("=")[0], float(x.split("=")[1])), result)

def getTopExplanations(searchID1, searchID2, givenName1, givenName2):
	pages = getTopRelatedTopics(searchID1, searchID2, 20)
	results = []
	queue = Queue()
	client = MongoClient("downey-n2.cs.northwestern.edu", 27017, slaveOk=True)
	client.the_database.authenticate("websail", "WikificAtionN", "enwiki_20150304")
	enwiki=client['enwiki_20150304']
	if givenName1=="" or givenName2=="":
		givenName1 =  enwiki['page'].find_one({'title.id':int(searchID1), 'title.namesapce':0}, {'title' : True})['title']['title']
		givenName2 =  enwiki['page'].find_one({'title.id':int(searchID2), 'title.namesapce':0}, {'title' : True})['title']['title']
	map(lambda (key, value) : Thread(target=filterText, args=(key, value, enwiki, givenName1.replace(".",""), givenName2.replace(".",""), queue)).run() , pages)
	intermResults = [queue.get() for i in pages]
	intermResults.sort(reverse=True)
	results = filter(lambda x: x[1]['type']==1, intermResults) or filter(lambda x: x[1]['type']==2 and x[1]['paragraphs'], intermResults)
	return {"id1": searchID1, "id2":searchID2, "title1":givenName1, "title2":givenName2 , "explanations" : [i[1] for i in results], "common pages" : [i[1]['title'] for i in intermResults]}

if __name__ == "__main__":
	if (len(sys.argv)==5):
		searchID1 = sys.argv[1]
		searchID2 = sys.argv[2]
		givenName1 = sys.argv[3]
		givenName2 = sys.argv[4]
	else:
		searchID1 = sys.argv[1]
		searchID2 = sys.argv[2]
		givenName1 = ""
		givenName2 = ""
	print dumps(getTopExplanations(searchID1, searchID2, givenName1, givenName2))
